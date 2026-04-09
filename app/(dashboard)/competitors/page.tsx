'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import PageHeader from '@/components/layout/PageHeader'
import AddCompetitorForm from '@/components/competitors/AddCompetitorForm'
import ThreatCards, { type CompetitorThreat } from '@/components/competitors/ThreatCards'
import HeadToHead from '@/components/competitors/HeadToHead'
import InsightBanner from '@/components/competitors/InsightBanner'
import ContentFingerprint from '@/components/competitors/ContentFingerprint'
import AdIntelligence from '@/components/competitors/AdIntelligence'
import ContentGapAnalysis from '@/components/competitors/ContentGapAnalysis'
import CompetitiveBrief from '@/components/competitors/CompetitiveBrief'
import type { Competitor, ScanResult } from '@/types'

interface PromptComparison {
  promptText: string
  clientMentioned: boolean
  competitorResults: { name: string; mentioned: boolean }[]
}

export default function CompetitorsPage() {
  const { activeClient } = useClient()
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [threats, setThreats] = useState<CompetitorThreat[]>([])
  const [comparisons, setComparisons] = useState<PromptComparison[]>([])
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
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
    } catch { /* */ }
    setDiscovering(false)
  }

  const fetchData = useCallback(async () => {
    if (!activeClient) {
      setCompetitors([])
      setThreats([])
      setComparisons([])
      setInsight(null)
      setLoading(false)
      return
    }

    setLoading(true)

    // Fetch competitors, scan results, and prompts in parallel
    const [compsRes, scansRes, promptsRes] = await Promise.all([
      supabase
        .from('competitors')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('created_at', { ascending: false }),
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

    if (comps.length === 0 || scans.length === 0) {
      setThreats([])
      setComparisons([])
      setInsight(null)
      setLoading(false)
      return
    }

    // Compute per-prompt latest results (one per model)
    const promptIds = [...new Set(scans.map((s) => s.prompt_id))]
    const promptMap = new Map(prompts.map((p) => [p.id, p.text]))

    // Fetch last week's scans for velocity
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const { data: lastWeekScans } = await supabase
      .from('scan_results')
      .select('competitor_mentions')
      .eq('client_id', activeClient.id)
      .gte('scanned_at', twoWeeksAgo.toISOString())
      .lt('scanned_at', oneWeekAgo.toISOString())

    const lastWeek = lastWeekScans || []

    // Client overall mention rate
    const clientMentions = scans.filter((s) => s.mentioned).length
    const clientMentionRate = scans.length > 0 ? Math.round((clientMentions / scans.length) * 100) : 0

    // Per-competitor: count how often they're mentioned
    const threatData: CompetitorThreat[] = comps.map((comp) => {
      let compMentionCount = 0
      let promptsWinning = 0

      for (const pid of promptIds) {
        const promptScans = scans.filter((s) => s.prompt_id === pid)
        const compMentioned = promptScans.some(
          (s) => s.competitor_mentions && s.competitor_mentions.includes(comp.name)
        )
        const clientMentioned = promptScans.some((s) => s.mentioned)

        if (compMentioned) compMentionCount++
        if (compMentioned && !clientMentioned) promptsWinning++
      }

      const mentionRate = promptIds.length > 0
        ? Math.round((compMentionCount / promptIds.length) * 100)
        : 0

      let threatLevel: 'high' | 'medium' | 'low' = 'low'
      if (mentionRate > clientMentionRate && promptsWinning > 2) {
        threatLevel = 'high'
      } else if (mentionRate > clientMentionRate || promptsWinning > 0) {
        threatLevel = 'medium'
      }

      // Competitor velocity: this week vs last week mention count
      const thisWeekScans = scans.filter(
        (s) => s.competitor_mentions && s.competitor_mentions.includes(comp.name)
      ).length
      const thisWeekTotal = scans.length
      const thisWeekRate = thisWeekTotal > 0 ? Math.round((thisWeekScans / thisWeekTotal) * 100) : 0

      const lastWeekCompCount = lastWeek.filter(
        (s: any) => s.competitor_mentions && s.competitor_mentions.includes(comp.name)
      ).length
      const lastWeekTotal = lastWeek.length
      const lastWeekRate = lastWeekTotal > 0 ? Math.round((lastWeekCompCount / lastWeekTotal) * 100) : 0

      const vDelta = thisWeekRate - lastWeekRate
      const velocity = lastWeekTotal > 0
        ? { delta: vDelta, direction: (vDelta > 0 ? 'up' : vDelta < 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat' }
        : undefined

      return {
        id: comp.id,
        name: comp.name,
        domain: comp.domain,
        mentionRate,
        clientMentionRate,
        promptsWinning,
        totalPrompts: promptIds.length,
        threatLevel,
        velocity,
      }
    })

    // Sort: high threats first
    threatData.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.threatLevel] - order[b.threatLevel]
    })
    setThreats(threatData)

    // Build head-to-head comparisons
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

    // Generate insight
    const highThreats = threatData.filter((t) => t.threatLevel === 'high')
    if (highThreats.length > 0) {
      const top = highThreats[0]
      setInsight(
        `${top.name} is your biggest AI visibility threat — mentioned ${top.mentionRate}% of the time vs your ${top.clientMentionRate}%, winning on ${top.promptsWinning} prompts where you're absent.`
      )
    } else if (threatData.some((t) => t.threatLevel === 'medium')) {
      setInsight('Some competitors are appearing in AI responses where you are not. Review the head-to-head table below for specific gaps.')
    } else {
      setInsight(null)
    }

    setLoading(false)
  }, [activeClient])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (!activeClient) {
    return (
      <div>
        <PageHeader title="Competitors" subtitle="Track and analyze competitor AI visibility" />
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mt-6">
          <p className="text-sm text-gray-500">Select or add a client to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Competitors"
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
            <p className="text-sm text-gray-400">Loading competitor data...</p>
          </div>
        ) : (
          <>
            {insight && <InsightBanner message={insight} />}

            {competitors.length > 0 && threats.length === 0 && comparisons.length === 0 && (
              <div className="bg-brand-bg border border-brand-border rounded-xl p-5 text-center">
                <p className="text-sm text-brand font-medium">
                  Add prompts on the AI Visibility page and run a scan to see threat data here.
                </p>
              </div>
            )}

            {/* Threat Cards */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-[2.5px] h-4 bg-brand rounded-full" />
                Threat Assessment
              </h3>
              <ThreatCards competitors={threats} onDeleted={fetchData} />
            </div>

            {/* Head-to-Head */}
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

            {/* Content Fingerprinting */}
            {competitors.filter((c) => c.domain).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-[2.5px] h-4 bg-brand rounded-full" />
                  Competitor Content Analysis
                </h3>
                <div className="space-y-4">
                  {competitors
                    .filter((c) => c.domain)
                    .map((comp) => (
                      <ContentFingerprint
                        key={comp.id}
                        competitorId={comp.id}
                        competitorName={comp.name}
                        competitorDomain={comp.domain}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Content Gap Analysis */}
            <ContentGapAnalysis />

            {/* Ad Intelligence */}
            {competitors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-[2.5px] h-4 bg-brand rounded-full" />
                  Ad Intelligence
                </h3>
                <div className="space-y-4">
                  {competitors.map((comp) => (
                    <AdIntelligence
                      key={comp.id}
                      competitorId={comp.id}
                      competitorName={comp.name}
                      competitorDomain={comp.domain}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
