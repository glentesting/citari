import { SupabaseClient } from '@supabase/supabase-js'

export interface SimulationInput {
  clientId: string
  targetScore: number
}

export interface EnhancedSimulationData {
  currentScore: number
  targetScore: number
  gap: number
  benchmarkAvg: number | null
  benchmarkNote: string | null
  historicalAccuracy: number | null
}

/**
 * Gather enhanced simulation data using cross-client benchmarks.
 */
export async function getEnhancedSimulationData(
  supabase: SupabaseClient,
  input: SimulationInput
): Promise<EnhancedSimulationData> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Current score
  const { data: scans } = await supabase
    .from('scan_results')
    .select('mentioned')
    .eq('client_id', input.clientId)
    .gte('scanned_at', thirtyDaysAgo.toISOString())

  const results = scans || []
  const currentMentions = results.filter((r) => r.mentioned).length
  const currentScore = results.length > 0 ? Math.round((currentMentions / results.length) * 100) : 0

  // Get client industry for benchmark lookup
  const { data: client } = await supabase
    .from('clients')
    .select('industry')
    .eq('id', input.clientId)
    .single()

  let benchmarkAvg: number | null = null
  let benchmarkNote: string | null = null

  if (client?.industry) {
    const { data: benchmark } = await supabase
      .from('category_benchmarks')
      .select('value, sample_size')
      .eq('industry', client.industry.toLowerCase().trim())
      .eq('metric', 'monthly_summary')
      .single()

    if (benchmark?.value) {
      benchmarkAvg = (benchmark.value as any).avgVisibilityScore || null
      if (benchmarkAvg !== null) {
        benchmarkNote = `Based on ${benchmark.sample_size || 'multiple'} businesses in ${client.industry}, the average visibility score is ${benchmarkAvg}%.`
      }
    }
  }

  return {
    currentScore,
    targetScore: input.targetScore,
    gap: input.targetScore - currentScore,
    benchmarkAvg,
    benchmarkNote,
    historicalAccuracy: null, // Would be populated as simulation predictions are tracked over time
  }
}
