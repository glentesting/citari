'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import PageHeader from '@/components/layout/PageHeader'
import PlatformCards from '@/components/visibility/PlatformCards'
import AddPromptForm from '@/components/visibility/AddPromptForm'
import SuggestedPrompts from '@/components/visibility/SuggestedPrompts'
import PromptTable from '@/components/visibility/PromptTable'
import CitationSourceBreakdown from '@/components/visibility/CitationSourceBreakdown'
import SeasonalityView from '@/components/visibility/SeasonalityView'
import type { Prompt, ScanResult } from '@/types'

export default function VisibilityPage() {
  const { activeClient } = useClient()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!activeClient) {
      setPrompts([])
      setScanResults([])
      setLoading(false)
      return
    }

    setLoading(true)

    const [promptsRes, scansRes] = await Promise.all([
      supabase
        .from('prompts')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('scan_results')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('scanned_at', { ascending: false })
        .limit(300),
    ])

    setPrompts(promptsRes.data || [])
    setScanResults(scansRes.data || [])
    setLoading(false)
  }, [activeClient])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function runScan() {
    if (!activeClient) return
    setScanning(true)
    setScanMessage(null)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        setScanMessage(`Scan failed: ${data.error}`)
      } else {
        setScanMessage(
          `Scan complete — ${data.scanned} prompt${data.scanned !== 1 ? 's' : ''} scanned, ${data.summary.total_mentions}/${data.summary.total_results} mentions detected.`
        )
        await fetchData()
      }
    } catch (err) {
      setScanMessage('Scan failed: Network error')
    } finally {
      setScanning(false)
    }
  }

  // Compute platform stats from scan results
  const models = ['chatgpt', 'claude', 'gemini'] as const
  const modelLabels: Record<string, string> = {
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
  }
  const modelColors: Record<string, string> = {
    chatgpt: '#10A37F',
    claude: '#D97757',
    gemini: '#4285F4',
  }

  const platformData = models.map((model) => {
    const modelResults = scanResults.filter((r) => r.model === model)
    const mentions = modelResults.filter((r) => r.mentioned).length
    return {
      name: modelLabels[model],
      mentionRate: modelResults.length > 0
        ? Math.round((mentions / modelResults.length) * 100)
        : 0,
      totalScans: modelResults.length,
      color: modelColors[model],
    }
  })

  if (!activeClient) {
    return (
      <div>
        <PageHeader
          title="AI Visibility"
          subtitle="Track how AI models mention your client's brand"
        />
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mt-6">
          <p className="text-sm text-gray-500">Select or add a client to get started.</p>
        </div>
      </div>
    )
  }

  const activeCount = prompts.filter((p) => p.is_active).length

  return (
    <div>
      <PageHeader
        title="AI Visibility"
        subtitle={`Tracking ${activeCount} active prompt${activeCount !== 1 ? 's' : ''} for ${activeClient.name}`}
        action={
          <button
            onClick={runScan}
            disabled={scanning || activeCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {scanning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
                Run Scan
              </>
            )}
          </button>
        }
      />

      <div className="mt-6 space-y-6">
        {/* Scan status message */}
        {scanMessage && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${
            scanMessage.includes('failed')
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-brand-bg border-brand-border text-brand'
          }`}>
            {scanMessage}
          </div>
        )}

        {/* Platform cards */}
        {scanResults.length > 0 && <PlatformCards platforms={platformData} />}

        {/* AI-Suggested Prompts */}
        <SuggestedPrompts onAdded={fetchData} />

        {/* Add prompt form */}
        <AddPromptForm onAdded={fetchData} />

        {/* Prompt table */}
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400">Loading prompts...</p>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-[2.5px] h-4 bg-brand rounded-full" />
              Tracking Prompts
              <span className="text-xs font-normal text-gray-400">({prompts.length})</span>
            </h3>
            <PromptTable prompts={prompts} scanResults={scanResults} onUpdated={fetchData} />
          </div>
        )}

        {/* Citation sources + Seasonality */}
        <CitationSourceBreakdown />
        <SeasonalityView />
      </div>
    </div>
  )
}
