'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import StatsStrip from '@/components/layout/StatsStrip'
import AlertBanner from '@/components/overview/AlertBanner'
import PlatformBars from '@/components/overview/PlatformBars'
import CompetitorGapList from '@/components/overview/CompetitorGapList'
import GeoTaskList from '@/components/overview/GeoTaskList'
import ShareOfVoice from '@/components/overview/ShareOfVoice'
import Simulator from '@/components/overview/Simulator'

interface ShareEntry {
  name: string
  share: number
  isClient: boolean
}

interface OverviewData {
  visibilityScore: number
  avgMentionPosition: number | null
  shareOfVoice: ShareEntry[]
  clientShare: number
  competitorGapCount: number
  geoContentCount: number
  reportsCount: number
  platformRates: { name: string; mentionRate: number; color: string }[]
  gaps: { promptText: string; competitorsMentioned: string[] }[]
  hasPrompts: boolean
  alertMessage: string | null
}

export default function OverviewPage() {
  const { activeClient, refreshClients } = useClient()
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningSetup, setRunningSetup] = useState(false)
  const [setupStep, setSetupStep] = useState(0)
  const supabase = createClient()
  const router = useRouter()

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
      .select('model, mentioned, mention_position, competitor_mentions, prompt_id')
      .eq('client_id', activeClient.id)
      .gte('scanned_at', since)

    const results = scanResults || []
    const totalResults = results.length
    const totalMentions = results.filter((r) => r.mentioned).length

    // Visibility score
    const visibilityScore = totalResults > 0
      ? Math.round((totalMentions / totalResults) * 100)
      : 0

    // Average mention position
    const positions = results
      .filter((r: any) => r.mention_position != null)
      .map((r: any) => r.mention_position as number)
    const avgPosition = positions.length > 0
      ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
      : null

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

    // Calculate velocity per model (this week vs last week)
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const oneWeekAgoStr = oneWeekAgo.toISOString()
    const twoWeeksAgoStr = twoWeeksAgo.toISOString()

    const { data: lastWeekScans } = await supabase
      .from('scan_results')
      .select('model, mentioned')
      .eq('client_id', activeClient.id)
      .gte('scanned_at', twoWeeksAgoStr)
      .lt('scanned_at', oneWeekAgoStr)

    const lastWeek = lastWeekScans || []

    const platformRates = models.map((model) => {
      const modelResults = results.filter((r) => r.model === model)
      const modelMentions = modelResults.filter((r) => r.mentioned).length
      const currentRate = modelResults.length > 0
        ? Math.round((modelMentions / modelResults.length) * 100)
        : 0

      const prevResults = lastWeek.filter((r) => r.model === model)
      const prevMentions = prevResults.filter((r) => r.mentioned).length
      const prevRate = prevResults.length > 0
        ? Math.round((prevMentions / prevResults.length) * 100)
        : 0

      const delta = currentRate - prevRate
      return {
        name: modelLabels[model],
        mentionRate: currentRate,
        color: modelColors[model],
        velocity: prevResults.length > 0
          ? { delta, direction: (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat' }
          : undefined,
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

    // Share of Voice
    const mentionCounts = new Map<string, number>()
    mentionCounts.set(activeClient.name, 0)
    for (const r of results) {
      if (r.mentioned) {
        mentionCounts.set(activeClient.name, (mentionCounts.get(activeClient.name) || 0) + 1)
      }
      const compMentions = (r as any).competitor_mentions as string[] | null
      if (compMentions) {
        for (const comp of compMentions) {
          mentionCounts.set(comp, (mentionCounts.get(comp) || 0) + 1)
        }
      }
    }
    const totalBrandMentions = Array.from(mentionCounts.values()).reduce((a, b) => a + b, 0)
    const shareOfVoice: ShareEntry[] = Array.from(mentionCounts.entries())
      .map(([name, mentions]) => ({
        name,
        share: totalBrandMentions > 0 ? Math.round((mentions / totalBrandMentions) * 100) : 0,
        isClient: name === activeClient.name,
      }))
      .sort((a, b) => b.share - a.share)
    const clientShare = shareOfVoice.find((e) => e.isClient)?.share || 0

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

    // Check if any prompts exist
    const { count: promptCount } = await supabase
      .from('prompts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', activeClient.id)

    setData({
      visibilityScore,
      avgMentionPosition: avgPosition,
      shareOfVoice,
      clientShare,
      competitorGapCount: gapMap.size,
      geoContentCount: geoCount || 0,
      reportsCount: reportsCount || 0,
      platformRates,
      gaps,
      hasPrompts: (promptCount || 0) > 0,
      alertMessage,
    })
    setLoading(false)
  }, [activeClient])

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

  const setupSteps = [
    { label: 'Discovering competitors...', key: 'competitors' },
    { label: 'Generating tracking prompts...', key: 'prompts' },
    { label: 'Finding keyword opportunities...', key: 'keywords' },
    { label: 'Running first AI scan...', key: 'scan' },
  ]

  async function handleRunSetup() {
    if (!activeClient) return
    setRunningSetup(true)
    setSetupStep(0)

    const stepInterval = setInterval(() => {
      setSetupStep((prev) => Math.min(prev + 1, setupSteps.length - 1))
    }, 4000)

    try {
      await fetch('/api/clients/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id }),
      })
    } catch { /* continue */ }

    clearInterval(stepInterval)
    await refreshClients()
    setRunningSetup(false)
    fetchData()
  }

  if (runningSetup) {
    return (
      <div>
        <PageHeader title="Overview" subtitle={activeClient.name} />
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-brand animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Setting up {activeClient.name}...</h2>
            <p className="text-sm text-gray-500 mt-1">This takes about 30-60 seconds</p>
          </div>
          <div className="space-y-3 max-w-sm mx-auto">
            {setupSteps.map((step, i) => (
              <div key={step.key} className="flex items-center gap-3">
                {i < setupStep ? (
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                ) : i === setupStep ? (
                  <div className="w-6 h-6 rounded-full bg-brand-bg flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0" />
                )}
                <span className={`text-sm ${
                  i < setupStep ? 'text-green-600 font-medium' :
                  i === setupStep ? 'text-gray-900 font-medium' :
                  'text-gray-400'
                }`}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Overview" subtitle={activeClient.name} />

      <div className="mt-6 space-y-6">
        {d.alertMessage && <AlertBanner message={d.alertMessage} />}

        {/* Run Setup for empty clients */}
        {d.visibilityScore === 0 && !d.hasPrompts && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <div className="w-12 h-12 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No data yet for {activeClient.name}</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
              Let Citari auto-discover competitors, generate tracking prompts, find keywords, and run your first AI scan.
            </p>
            <button onClick={handleRunSetup}
              className="px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors">
              Run Auto-Setup
            </button>
          </div>
        )}

        <StatsStrip
          stats={[
            {
              label: 'AI Visibility Score',
              value: `${d.visibilityScore}%`,
              change: d.visibilityScore >= 50 ? 'Good' : 'Needs improvement',
              changeType: d.visibilityScore >= 50 ? 'positive' : 'negative',
            },
            {
              label: 'Avg Mention Position',
              value: d.avgMentionPosition !== null ? `#${d.avgMentionPosition}` : '—',
              change: d.avgMentionPosition !== null
                ? d.avgMentionPosition <= 2 ? 'Excellent placement' : d.avgMentionPosition <= 4 ? 'Good placement' : 'Room to improve'
                : 'No data yet',
              changeType: d.avgMentionPosition !== null
                ? d.avgMentionPosition <= 3 ? 'positive' : 'neutral'
                : 'neutral',
            },
            {
              label: 'Competitor Gaps',
              value: d.competitorGapCount,
              change: d.competitorGapCount > 0 ? 'Prompts where competitors appear but you don\'t' : 'No gaps',
              changeType: d.competitorGapCount > 0 ? 'negative' : 'positive',
            },
            {
              label: 'Share of Voice',
              value: `${d.clientShare}%`,
              change: d.clientShare >= 30 ? 'Strong presence' : d.clientShare > 0 ? 'Room to grow' : 'No data',
              changeType: d.clientShare >= 30 ? 'positive' : 'neutral',
            },
          ]}
        />

        <div className="grid grid-cols-2 gap-6">
          <PlatformBars platforms={d.platformRates} />
          <CompetitorGapList gaps={d.gaps} />
        </div>

        {d.shareOfVoice.length > 1 && (
          <ShareOfVoice
            entries={d.shareOfVoice}
            clientShare={d.clientShare}
            industry={activeClient.industry || undefined}
          />
        )}

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

        <Simulator currentScore={d.visibilityScore} />
      </div>
    </div>
  )
}
