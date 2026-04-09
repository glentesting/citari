import { SupabaseClient } from '@supabase/supabase-js'

export interface VelocityResult {
  current: number
  previous: number
  delta: number
  direction: 'up' | 'down' | 'flat'
}

/**
 * Compare this week's mention rate vs last week's for a client, optionally per model.
 */
export async function calculateVelocity(
  supabase: SupabaseClient,
  clientId: string,
  model?: 'chatgpt' | 'claude' | 'gemini'
): Promise<VelocityResult> {
  const now = new Date()

  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - 7)

  const lastWeekStart = new Date(now)
  lastWeekStart.setDate(now.getDate() - 14)

  // Build queries
  let thisWeekQuery = supabase
    .from('scan_results')
    .select('mentioned')
    .eq('client_id', clientId)
    .gte('scanned_at', thisWeekStart.toISOString())

  let lastWeekQuery = supabase
    .from('scan_results')
    .select('mentioned')
    .eq('client_id', clientId)
    .gte('scanned_at', lastWeekStart.toISOString())
    .lt('scanned_at', thisWeekStart.toISOString())

  if (model) {
    thisWeekQuery = thisWeekQuery.eq('model', model)
    lastWeekQuery = lastWeekQuery.eq('model', model)
  }

  const [thisWeekRes, lastWeekRes] = await Promise.all([thisWeekQuery, lastWeekQuery])

  const thisWeekData = thisWeekRes.data || []
  const lastWeekData = lastWeekRes.data || []

  const current = thisWeekData.length > 0
    ? Math.round((thisWeekData.filter((r) => r.mentioned).length / thisWeekData.length) * 100)
    : 0

  const previous = lastWeekData.length > 0
    ? Math.round((lastWeekData.filter((r) => r.mentioned).length / lastWeekData.length) * 100)
    : 0

  const delta = current - previous
  const direction: 'up' | 'down' | 'flat' =
    delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

  return { current, previous, delta, direction }
}
