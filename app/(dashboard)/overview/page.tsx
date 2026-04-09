'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import PageHeader from '@/components/layout/PageHeader'
import StatsStrip from '@/components/layout/StatsStrip'
import AlertBanner from '@/components/overview/AlertBanner'
import PlatformBars from '@/components/overview/PlatformBars'
import CompetitorGapList from '@/components/overview/CompetitorGapList'
import GeoTaskList from '@/components/overview/GeoTaskList'

interface OverviewData {
  visibilityScore: number
  competitorGapCount: number
  geoContentCount: number
  reportsCount: number
  platformRates: { name: string; mentionRate: number; color: string }[]
  gaps: { promptText: string; competitorsMentioned: string[] }[]
  alertMessage: string | null
}

export default function OverviewPage() {
  const { activeClient } = useClient()
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!activeClient) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const since = thirtyDaysAgo.toISOString()

    // Fetch scan results for last 30 days
    const { data: scanResults } = await supabase
      .from('scan_results')
      .select('model, mentioned, competitor_mentions, prompt_id')
      .eq('client_id', activeClient.id)
      .gte('scanned_at', since)

    const results = scanResults || []
    const totalResults = results.length
    const totalMentions = results.filter((r) => r.mentioned).length

    // Visibility score
    const visibilityScore = totalResults > 0
      ? Math.round((totalMentions / totalResults) * 100)
      : 0

    // Per-platform rates
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

    const platformRates = models.map((model) => {
      const modelResults = results.filter((r) => r.model === model)
      const modelMentions = modelResults.filter((r) => r.mentioned).length
      return {
        name: modelLabels[model],
        mentionRate: modelResults.length > 0
          ? Math.round((modelMentions / modelResults.length) * 100)
          : 0,
        color: modelColors[model],
      }
    })

    // Competitor gaps: prompts where a competitor was mentioned but client was NOT
    const promptIds = [...new Set(results.map((r) => r.prompt_id))]

    // Fetch prompt texts
    const { data: prompts } = await supabase
      .from('prompts')
      .select('id, text')
      .in('id', promptIds.length > 0 ? promptIds : ['none'])

    const promptMap = new Map((prompts || []).map((p) => [p.id, p.text]))

    const gapMap = new Map<string, Set<string>>()
    for (const r of results) {
      if (!r.mentioned && r.competitor_mentions && r.competitor_mentions.length > 0) {
        if (!gapMap.has(r.prompt_id)) gapMap.set(r.prompt_id, new Set())
        for (const c of r.competitor_mentions) {
          gapMap.get(r.prompt_id)!.add(c)
        }
      }
    }

    const gaps = Array.from(gapMap.entries())
      .map(([promptId, comps]) => ({
        promptText: promptMap.get(promptId) || 'Unknown prompt',
        competitorsMentioned: Array.from(comps),
      }))
      .slice(0, 10)

    // GEO content count
    const { count: geoCount } = await supabase
      .from('geo_content')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', activeClient.id)

    // Reports count this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: reportsCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', activeClient.id)
      .gte('created_at', startOfMonth.toISOString())

    // Alert message
    let alertMessage: string | null = null
    if (totalResults === 0) {
      alertMessage = 'No scan data yet. Add prompts and run your first scan from the AI Visibility page.'
    } else if (visibilityScore < 30) {
      alertMessage = `Your AI visibility score is ${visibilityScore}%. Consider creating GEO content to improve brand mentions.`
    }

    setData({
      visibilityScore,
      competitorGapCount: gapMap.size,
      geoContentCount: geoCount || 0,
      reportsCount: reportsCount || 0,
      platformRates,
      gaps,
      alertMessage,
    })
    setLoading(false)
  }, [activeClient, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (!activeClient) {
    return (
      <div>
        <PageHeader title="Overview" subtitle="Select a client to see your dashboard" />
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">Select or add a client from the sidebar to get started.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Overview" subtitle={activeClient.name} />
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-400 animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const d = data!

  return (
    <div>
      <PageHeader title="Overview" subtitle={activeClient.name} />

      <div className="mt-6 space-y-6">
        {d.alertMessage && <AlertBanner message={d.alertMessage} />}

        <StatsStrip
          stats={[
            {
              label: 'AI Visibility Score',
              value: `${d.visibilityScore}%`,
              change: d.visibilityScore >= 50 ? 'Good' : 'Needs improvement',
              changeType: d.visibilityScore >= 50 ? 'positive' : 'negative',
            },
            {
              label: 'Competitor Gaps',
              value: d.competitorGapCount,
              change: d.competitorGapCount > 0 ? 'Prompts where competitors appear but you don\'t' : 'No gaps',
              changeType: d.competitorGapCount > 0 ? 'negative' : 'positive',
            },
            {
              label: 'GEO Content',
              value: d.geoContentCount,
            },
            {
              label: 'Reports This Month',
              value: d.reportsCount,
            },
          ]}
        />

        <div className="grid grid-cols-2 gap-6">
          <PlatformBars platforms={d.platformRates} />
          <CompetitorGapList gaps={d.gaps} />
        </div>

        <GeoTaskList
          tasks={
            d.gaps.length > 0
              ? d.gaps.slice(0, 5).map((gap, i) => ({
                  number: i + 1,
                  text: `Create content targeting: "${gap.promptText}" — competitors ${gap.competitorsMentioned.join(', ')} are being mentioned instead.`,
                }))
              : d.visibilityScore < 50
              ? [
                  { number: 1, text: 'Add more tracking prompts relevant to your client\'s industry.' },
                  { number: 2, text: 'Create FAQ and comparison content optimized for AI citation.' },
                  { number: 3, text: 'Ensure your client\'s brand appears on authoritative sources AI models reference.' },
                ]
              : []
          }
        />
      </div>
    </div>
  )
}
