import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Enhanced velocity: 8-week trend data per platform.
 */
export interface WeeklyTrend {
  week: string // ISO date of week start
  chatgpt: number
  claude: number
  gemini: number
  overall: number
}

export async function getVelocityTrend(
  supabase: SupabaseClient,
  clientId: string,
  weeks: number = 8
): Promise<WeeklyTrend[]> {
  const trends: WeeklyTrend[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() - i * 7)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekStart.getDate() - 7)

    const { data: scans } = await supabase
      .from('scan_results')
      .select('model, mentioned')
      .eq('client_id', clientId)
      .gte('scanned_at', weekStart.toISOString())
      .lt('scanned_at', weekEnd.toISOString())

    const results = scans || []
    if (results.length === 0) {
      trends.push({
        week: weekStart.toISOString().split('T')[0],
        chatgpt: 0, claude: 0, gemini: 0, overall: 0,
      })
      continue
    }

    const calc = (model: string) => {
      const m = results.filter((r) => r.model === model)
      return m.length > 0 ? Math.round((m.filter((r) => r.mentioned).length / m.length) * 100) : 0
    }

    const overall = Math.round((results.filter((r) => r.mentioned).length / results.length) * 100)

    trends.push({
      week: weekStart.toISOString().split('T')[0],
      chatgpt: calc('chatgpt'),
      claude: calc('claude'),
      gemini: calc('gemini'),
      overall,
    })
  }

  return trends
}

/**
 * Competitor acceleration score: who's growing fastest over last 4 weeks.
 */
export interface CompetitorAcceleration {
  name: string
  weeklyRates: number[]
  acceleration: number // positive = growing, negative = declining
  trend: 'accelerating' | 'decelerating' | 'stable'
}

export async function getCompetitorAcceleration(
  supabase: SupabaseClient,
  clientId: string
): Promise<CompetitorAcceleration[]> {
  const { data: competitors } = await supabase
    .from('competitors')
    .select('name')
    .eq('client_id', clientId)

  if (!competitors || competitors.length === 0) return []

  const results: CompetitorAcceleration[] = []

  for (const comp of competitors) {
    const weeklyRates: number[] = []

    for (let i = 3; i >= 0; i--) {
      const weekEnd = new Date()
      weekEnd.setDate(weekEnd.getDate() - i * 7)
      const weekStart = new Date(weekEnd)
      weekStart.setDate(weekStart.getDate() - 7)

      const { data: scans } = await supabase
        .from('scan_results')
        .select('competitor_mentions')
        .eq('client_id', clientId)
        .gte('scanned_at', weekStart.toISOString())
        .lt('scanned_at', weekEnd.toISOString())

      const total = scans?.length || 0
      const mentioned = (scans || []).filter((s) =>
        s.competitor_mentions?.includes(comp.name)
      ).length
      weeklyRates.push(total > 0 ? Math.round((mentioned / total) * 100) : 0)
    }

    // Calculate acceleration (change in rate of change)
    const deltas = weeklyRates.slice(1).map((r, i) => r - weeklyRates[i])
    const avgDelta = deltas.length > 0
      ? deltas.reduce((a, b) => a + b, 0) / deltas.length
      : 0

    results.push({
      name: comp.name,
      weeklyRates,
      acceleration: Math.round(avgDelta * 10) / 10,
      trend: avgDelta > 1 ? 'accelerating' : avgDelta < -1 ? 'decelerating' : 'stable',
    })
  }

  return results.sort((a, b) => b.acceleration - a.acceleration)
}
