'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface Opportunity {
  id: string
  source_domain: string
  source_url: string | null
  relevance_score: number
  opportunity_type: string
  status: string
}

const typeLabels: Record<string, { label: string; bg: string; text: string }> = {
  guest_post: { label: 'Guest Post', bg: 'bg-blue-50', text: 'text-blue-700' },
  resource_page: { label: 'Resource Page', bg: 'bg-green-50', text: 'text-green-700' },
  broken_link: { label: 'Broken Link', bg: 'bg-amber-50', text: 'text-amber-700' },
  mention: { label: 'Mention', bg: 'bg-purple-50', text: 'text-purple-700' },
  directory: { label: 'Directory', bg: 'bg-gray-100', text: 'text-gray-700' },
}

export default function BacklinkOpportunities() {
  const { activeClient } = useClient()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [discoverMsg, setDiscoverMsg] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('all')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      if (!activeClient) { setOpportunities([]); setLoading(false); return }
      setLoading(true)
      const { data } = await supabase
        .from('backlink_opportunities')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('relevance_score', { ascending: false })
      setOpportunities(data || [])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient])

  async function handleDiscover() {
    if (!activeClient) return
    setDiscovering(true)
    setDiscoverMsg(null)
    try {
      const res = await fetch('/api/backlinks/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id }),
      })
      const data = await res.json()
      setDiscoverMsg(res.ok ? `Found ${data.found} opportunities` : data.error)
      if (res.ok) {
        const { data: updated } = await supabase.from('backlink_opportunities').select('*').eq('client_id', activeClient.id).order('relevance_score', { ascending: false })
        setOpportunities(updated || [])
      }
    } catch { setDiscoverMsg('Discovery failed') }
    setDiscovering(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('backlink_opportunities').update({ status }).eq('id', id)
    setOpportunities((prev) => prev.map((o) => o.id === id ? { ...o, status } : o))
  }

  if (!activeClient) return null

  const types = [...new Set(opportunities.map((o) => o.opportunity_type))]
  const filtered = filterType === 'all' ? opportunities : opportunities.filter((o) => o.opportunity_type === filterType)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-[2.5px] h-4 bg-brand rounded-full" />
            Backlink Opportunities
          </h3>
          {opportunities.length > 0 && <p className="text-xs text-gray-500 mt-0.5">{opportunities.length} opportunities found</p>}
        </div>
        <button onClick={handleDiscover} disabled={discovering}
          className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
          {discovering ? 'Discovering...' : 'Discover Opportunities'}
        </button>
      </div>

      {discoverMsg && <div className={`px-5 py-2 text-xs font-medium border-b ${discoverMsg.includes('fail') ? 'bg-red-50 text-red-700' : 'bg-brand-bg text-brand'}`}>{discoverMsg}</div>}

      {types.length > 1 && (
        <div className="px-5 py-2 border-b border-gray-100 flex gap-2 flex-wrap">
          <button onClick={() => setFilterType('all')}
            className={`px-3 py-1 text-xs font-medium rounded-full ${filterType === 'all' ? 'bg-brand-bg text-brand' : 'bg-gray-100 text-gray-600'}`}>All</button>
          {types.map((t) => {
            const label = typeLabels[t]?.label || t
            return (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1 text-xs font-medium rounded-full ${filterType === t ? 'bg-brand-bg text-brand' : 'bg-gray-100 text-gray-600'}`}>{label}</button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center"><p className="text-sm text-gray-400">Loading...</p></div>
      ) : opportunities.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">Click &quot;Discover Opportunities&quot; to find domains linking to competitors but not you.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {filtered.map((o) => {
            const type = typeLabels[o.opportunity_type] || typeLabels.mention
            return (
              <div key={o.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{o.source_domain}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${type.bg} ${type.text}`}>{type.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">Relevance: {o.relevance_score}/10</span>
                    {o.source_url && (
                      <a href={o.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">View →</a>
                    )}
                  </div>
                </div>
                <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                  <option value="identified">Identified</option>
                  <option value="outreach_sent">Outreach Sent</option>
                  <option value="acquired">Acquired</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
