'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface Gap {
  id: string
  topic: string
  competitor_url: string | null
  gap_score: number
  estimated_impact: string
  status: string
  competitor_name?: string
}

export default function ContentGapAnalysis() {
  const { activeClient } = useClient()
  const [gaps, setGaps] = useState<Gap[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      if (!activeClient) { setGaps([]); setLoading(false); return }
      setLoading(true)
      const { data } = await supabase
        .from('content_gaps')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('gap_score', { ascending: false })
      setGaps(data || [])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient])

  async function runAnalysis() {
    if (!activeClient) return
    setAnalyzing(true)
    setAnalyzeMsg(null)

    // Get first competitor with crawled content
    const { data: competitors } = await supabase
      .from('competitors')
      .select('id, name')
      .eq('client_id', activeClient.id)

    let totalGaps = 0
    for (const comp of competitors || []) {
      try {
        const res = await fetch('/api/content-gaps/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: activeClient.id, competitor_id: comp.id }),
        })
        const data = await res.json()
        if (res.ok) totalGaps += data.gaps || 0
      } catch { /* continue */ }
    }

    setAnalyzeMsg(`Found ${totalGaps} content gaps`)
    // Refresh
    const { data } = await supabase.from('content_gaps').select('*').eq('client_id', activeClient.id).order('gap_score', { ascending: false })
    setGaps(data || [])
    setAnalyzing(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('content_gaps').update({ status }).eq('id', id)
    setGaps((prev) => prev.map((g) => g.id === id ? { ...g, status } : g))
  }

  if (!activeClient) return null

  const open = gaps.filter((g) => g.status === 'open')
  const inProgress = gaps.filter((g) => g.status === 'in_progress')

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-[2.5px] h-4 bg-brand rounded-full" />
            Content Gap Analysis
          </h3>
          {gaps.length > 0 && <p className="text-xs text-gray-500 mt-0.5">{open.length} open · {inProgress.length} in progress</p>}
        </div>
        <button onClick={runAnalysis} disabled={analyzing}
          className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
          {analyzing ? 'Analyzing...' : 'Analyze Gaps'}
        </button>
      </div>

      {analyzeMsg && <div className="px-5 py-2 text-xs font-medium bg-brand-bg border-b border-brand-border text-brand">{analyzeMsg}</div>}

      {loading ? (
        <div className="p-8 text-center"><p className="text-sm text-gray-400">Loading...</p></div>
      ) : gaps.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">Click &quot;Analyze Gaps&quot; to compare your content against competitors.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {gaps.map((g) => (
            <div key={g.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{g.topic}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                      g.estimated_impact === 'high' ? 'bg-red-50 text-red-700' :
                      g.estimated_impact === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {g.estimated_impact} impact
                    </span>
                    <span className="text-[10px] text-gray-400">Score: {g.gap_score}/10</span>
                  </div>
                </div>
                <select value={g.status} onChange={(e) => updateStatus(g.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
