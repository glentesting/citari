'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import PageHeader from '@/components/layout/PageHeader'
import AddCompetitorForm from '@/components/competitors/AddCompetitorForm'
import CompetitorIntelCard from '@/components/competitors/CompetitorIntelCard'
import HeadToHead from '@/components/competitors/HeadToHead'
import type { Competitor, ScanResult } from '@/types'

interface PromptComparison {
  promptText: string
  clientMentioned: boolean
  competitorResults: { name: string; mentioned: boolean }[]
}

export default function CompetitorsPage() {
  const { activeClient } = useClient()
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [comparisons, setComparisons] = useState<PromptComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [reanalyzingAll, setReanalyzingAll] = useState(false)
  const supabase = createClient()

  async function handleDiscover() {
    if (!activeClient) return
    setDiscovering(true)
    try {
      const res = await fetch('/api/competitors/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.competitors) {
          for (const comp of data.competitors) {
            await supabase.from('competitors').insert({
              client_id: activeClient.id,
              name: comp.name,
              domain: comp.domain || null,
            })
          }
          fetchData()
        }
      }
    } catch (e) { console.error('Competitor discovery failed:', e) }
    setDiscovering(false)
  }

  async function handleReanalyzeAll() {
    if (!activeClient || reanalyzingAll) return
    setReanalyzingAll(true)
    try {
      // Clear existing intel so it gets regenerated
      const { data: comps } = await supabase.from('competitors')
        .select('id')
        .eq('client_id', activeClient.id)

      for (const comp of (comps || [])) {
        await supabase.from('competitors').update({
          intel_brief: null, why_winning: null, content_gaps: null, visibility_score: null,
        }).eq('id', comp.id)
      }

      // Trigger enrich for all
      await fetch('/api/clients/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id }),
      })
    } catch (e) {
      console.error('Re-analyze all failed:', e)
    }
    setReanalyzingAll(false)
    fetchData()
  }

  const fetchData = useCallback(async () => {
    if (!activeClient) {
      setCompetitors([])
      setComparisons([])
      setLoading(false)
      return
    }

    setLoading(true)

    const [compsRes, scansRes, promptsRes] = await Promise.all([
      supabase
        .from('competitors')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('visibility_score', { ascending: false, nullsFirst: false }),
      supabase
        .from('scan_results')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('scanned_at', { ascending: false })
        .limit(500),
      supabase
        .from('prompts')
        .select('id, text')
        .eq('client_id', activeClient.id)
        .eq('is_active', true),
    ])

    const comps = compsRes.data || []
    const scans = (scansRes.data || []) as ScanResult[]
    const prompts = promptsRes.data || []
    setCompetitors(comps)

    // Build head-to-head comparisons if we have scan data
    if (scans.length > 0 && comps.length > 0) {
      const promptIds = [...new Set(scans.map((s) => s.prompt_id))]
      const promptMap = new Map(prompts.map((p) => [p.id, p.text]))

      const comparisonData: PromptComparison[] = promptIds.map((pid) => {
        const promptScans = scans.filter((s) => s.prompt_id === pid)
        const clientMentioned = promptScans.some((s) => s.mentioned)
        const competitorResults = comps.map((comp) => ({
          name: comp.name,
          mentioned: promptScans.some(
            (s) => s.competitor_mentions && s.competitor_mentions.includes(comp.name)
          ),
        }))
        return {
          promptText: promptMap.get(pid) || 'Unknown prompt',
          clientMentioned,
          competitorResults,
        }
      })
      setComparisons(comparisonData)
    } else {
      setComparisons([])
    }

    setLoading(false)
  }, [activeClient])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (!activeClient) {
    return (
      <div>
        <PageHeader title="Competitive Intelligence" subtitle="Track and outmaneuver your competitors" />
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mt-6">
          <p className="text-sm text-gray-500">Select or add a client to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Competitive Intelligence"
        subtitle={`${competitors.length} competitor${competitors.length !== 1 ? 's' : ''} tracked for ${activeClient.name}`}
      />

      <div className="mt-6 space-y-6">
        <AddCompetitorForm onAdded={fetchData} />

        {competitors.length === 0 && !loading && (
          <div className="bg-brand-bg border border-brand-border rounded-xl p-5 text-center">
            <p className="text-sm text-brand font-medium mb-3">Let AI discover your competitors automatically</p>
            <button onClick={handleDiscover} disabled={discovering}
              className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50">
              {discovering ? 'Discovering...' : 'Discover Competitors'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400">Loading competitor intelligence...</p>
          </div>
        ) : (
          <>
            {/* Competitor Intel Cards */}
            {competitors.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-[2.5px] h-4 bg-brand rounded-full" />
                    Competitor Intelligence
                  </h3>
                  <button onClick={handleReanalyzeAll} disabled={reanalyzingAll}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
                    {reanalyzingAll ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Re-analyzing all...
                      </>
                    ) : 'Re-analyze All'}
                  </button>
                </div>
                {competitors.map((comp) => (
                  <CompetitorIntelCard
                    key={comp.id}
                    competitor={comp}
                    clientName={activeClient.name}
                    onDeleted={fetchData}
                    onRefreshed={fetchData}
                  />
                ))}
              </div>
            )}

            {/* Head-to-Head Prompt Comparison */}
            {comparisons.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-[2.5px] h-4 bg-brand rounded-full" />
                  Head-to-Head Prompt Comparison
                </h3>
                <HeadToHead
                  comparisons={comparisons}
                  clientName={activeClient.name}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
