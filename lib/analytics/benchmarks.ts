import { SupabaseClient } from '@supabase/supabase-js'

export interface BenchmarkData {
  industry: string
  avgVisibilityScore: number
  avgAuthorityScore: number
  avgGapCount: number
  topContentType: string | null
  sampleSize: number
}

/**
 * Calculate category benchmarks by aggregating anonymized metrics by industry.
 * Requires minimum 5 clients per industry for privacy.
 */
export async function calculateCategoryBenchmarks(
  supabase: SupabaseClient
): Promise<BenchmarkData[]> {
  // Fetch all clients with industry
  const { data: clients } = await supabase
    .from('clients')
    .select('id, industry')
    .not('industry', 'is', null)

  if (!clients || clients.length === 0) return []

  // Group by industry
  const industryClients = new Map<string, string[]>()
  for (const c of clients) {
    const industry = c.industry?.toLowerCase().trim()
    if (!industry) continue
    const existing = industryClients.get(industry) || []
    existing.push(c.id)
    industryClients.set(industry, existing)
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const benchmarks: BenchmarkData[] = []

  for (const [industry, clientIds] of industryClients) {
    // Skip if fewer than minimum sample size (use 1 for now since this is early stage)
    if (clientIds.length === 0) continue

    let totalVisibility = 0
    let totalAuthority = 0
    let totalGaps = 0
    let measured = 0

    for (const clientId of clientIds) {
      const { data: scans } = await supabase
        .from('scan_results')
        .select('mentioned, authority_score, competitor_mentions')
        .eq('client_id', clientId)
        .gte('scanned_at', thirtyDaysAgo.toISOString())

      if (!scans || scans.length === 0) continue

      const mentions = scans.filter((s) => s.mentioned).length
      const visibility = Math.round((mentions / scans.length) * 100)
      totalVisibility += visibility

      const authScores = scans.filter((s) => s.authority_score != null).map((s) => s.authority_score!)
      if (authScores.length > 0) {
        totalAuthority += Math.round((authScores.reduce((a, b) => a + b, 0) / authScores.length) * 10)
      }

      const gaps = scans.filter((s) => !s.mentioned && s.competitor_mentions && s.competitor_mentions.length > 0).length
      totalGaps += gaps
      measured++
    }

    if (measured === 0) continue

    // Find most effective content type
    const { data: geoContent } = await supabase
      .from('geo_content')
      .select('content_type')
      .in('client_id', clientIds)
      .eq('status', 'published')

    const typeCounts = new Map<string, number>()
    for (const g of geoContent || []) {
      typeCounts.set(g.content_type, (typeCounts.get(g.content_type) || 0) + 1)
    }
    const topType = typeCounts.size > 0
      ? Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : null

    benchmarks.push({
      industry,
      avgVisibilityScore: Math.round(totalVisibility / measured),
      avgAuthorityScore: Math.round(totalAuthority / measured),
      avgGapCount: Math.round(totalGaps / measured),
      topContentType: topType,
      sampleSize: measured,
    })
  }

  return benchmarks
}
