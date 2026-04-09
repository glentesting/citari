import { SupabaseClient } from '@supabase/supabase-js'

export interface SeasonalPattern {
  promptId: string
  promptText: string
  monthlyCompetitiveness: Record<number, number> // month (1-12) → avg competitor mention count
  peakMonth: number
  peakLabel: string
  currentMonth: number
  weeksUntilPeak: number | null
  recommendation: string | null
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Analyze scan history to detect which prompts get more competitive by month.
 * Needs at least 2 months of data to produce useful patterns.
 */
export async function detectSeasonalPatterns(
  supabase: SupabaseClient,
  clientId: string
): Promise<SeasonalPattern[]> {
  const { data: prompts } = await supabase
    .from('prompts')
    .select('id, text')
    .eq('client_id', clientId)
    .eq('is_active', true)

  if (!prompts || prompts.length === 0) return []

  const { data: scans } = await supabase
    .from('scan_results')
    .select('prompt_id, competitor_mentions, scanned_at')
    .eq('client_id', clientId)
    .order('scanned_at', { ascending: true })

  if (!scans || scans.length === 0) return []

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const patterns: SeasonalPattern[] = []

  for (const prompt of prompts) {
    const promptScans = scans.filter((s) => s.prompt_id === prompt.id)
    if (promptScans.length < 10) continue

    // Group by month
    const monthlyComp: Record<number, number[]> = {}
    for (const scan of promptScans) {
      const month = new Date(scan.scanned_at).getMonth() + 1
      if (!monthlyComp[month]) monthlyComp[month] = []
      const compCount = scan.competitor_mentions?.length || 0
      monthlyComp[month].push(compCount)
    }

    // Calculate averages
    const monthlyAvg: Record<number, number> = {}
    let peakMonth = 1
    let peakValue = 0

    for (const [month, values] of Object.entries(monthlyComp)) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      const m = parseInt(month)
      monthlyAvg[m] = Math.round(avg * 100) / 100
      if (avg > peakValue) {
        peakValue = avg
        peakMonth = m
      }
    }

    // Calculate weeks until peak
    let weeksUntilPeak: number | null = null
    if (peakMonth !== currentMonth) {
      const monthsUntil = peakMonth > currentMonth
        ? peakMonth - currentMonth
        : 12 - currentMonth + peakMonth
      weeksUntilPeak = monthsUntil * 4
    }

    // Generate recommendation if peak is approaching
    let recommendation: string | null = null
    if (weeksUntilPeak !== null && weeksUntilPeak <= 8 && weeksUntilPeak > 0) {
      recommendation = `This prompt historically gets more competitive in ${MONTH_LABELS[peakMonth - 1]}. Start building content now — you have ~${weeksUntilPeak} weeks.`
    }

    patterns.push({
      promptId: prompt.id,
      promptText: prompt.text,
      monthlyCompetitiveness: monthlyAvg,
      peakMonth,
      peakLabel: MONTH_LABELS[peakMonth - 1],
      currentMonth,
      weeksUntilPeak,
      recommendation,
    })
  }

  // Sort by those with upcoming peaks first
  return patterns
    .filter((p) => Object.keys(p.monthlyCompetitiveness).length >= 2)
    .sort((a, b) => (a.weeksUntilPeak ?? 99) - (b.weeksUntilPeak ?? 99))
}
