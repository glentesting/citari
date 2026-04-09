import { SupabaseClient } from '@supabase/supabase-js'

export interface CitationSourceBreakdown {
  brandName: string
  sources: { source: string; type: string; count: number; percentage: number }[]
  totalCitations: number
  recommendation: string
}

/**
 * Aggregate citation sources for a client from scan results.
 */
export async function getCitationSourceBreakdown(
  supabase: SupabaseClient,
  clientId: string,
  clientName: string
): Promise<CitationSourceBreakdown> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: scans } = await supabase
    .from('scan_results')
    .select('citation_sources, citation_source_types, mentioned')
    .eq('client_id', clientId)
    .eq('mentioned', true)
    .gte('scanned_at', thirtyDaysAgo.toISOString())

  const results = scans || []
  const sourceCounts = new Map<string, { type: string; count: number }>()

  for (const r of results) {
    const sources = r.citation_sources || []
    const types = r.citation_source_types || []

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]
      const type = types[i] || 'unknown'
      const existing = sourceCounts.get(source)
      if (existing) {
        existing.count++
      } else {
        sourceCounts.set(source, { type, count: 1 })
      }
    }
  }

  const totalCitations = Array.from(sourceCounts.values()).reduce((sum, s) => sum + s.count, 0)

  const sources = Array.from(sourceCounts.entries())
    .map(([source, data]) => ({
      source,
      type: data.type,
      count: data.count,
      percentage: totalCitations > 0 ? Math.round((data.count / totalCitations) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // Generate recommendation
  const typeBreakdown = new Map<string, number>()
  for (const s of sources) {
    typeBreakdown.set(s.type, (typeBreakdown.get(s.type) || 0) + s.count)
  }

  let recommendation = ''
  const ownWebsite = typeBreakdown.get('own_website') || 0
  const reviewSite = typeBreakdown.get('review_site') || 0
  const press = typeBreakdown.get('press') || 0

  if (totalCitations === 0) {
    recommendation = "Your content isn't being cited yet. Focus on structured FAQ content and getting listed on review platforms."
  } else if (ownWebsite > totalCitations * 0.7) {
    recommendation = 'Your citations come almost entirely from your own website. Diversify with G2/Capterra reviews, press mentions, and directory listings.'
  } else if (reviewSite === 0) {
    recommendation = 'You have zero review site citations. Getting 20+ reviews on G2 or Google could significantly increase AI authority.'
  } else if (press === 0) {
    recommendation = 'No press citations detected. Getting featured in industry publications could boost your authority score.'
  } else {
    recommendation = 'Good citation diversity. Focus on increasing volume across your strongest citation sources.'
  }

  return { brandName: clientName, sources, totalCitations, recommendation }
}

/**
 * Generate a citation improvement strategy.
 */
export function generateCitationStrategy(
  clientBreakdown: CitationSourceBreakdown,
  competitorBreakdowns: CitationSourceBreakdown[]
): string[] {
  const actions: string[] = []

  // Compare citation source types
  const clientTypes = new Set(clientBreakdown.sources.map((s) => s.type))

  for (const comp of competitorBreakdowns) {
    for (const source of comp.sources) {
      if (!clientTypes.has(source.type) && source.percentage >= 20) {
        actions.push(
          `${comp.brandName} gets ${source.percentage}% of citations from ${source.type} sources — you have none. Focus on ${source.type} presence.`
        )
      }
    }
  }

  if (clientBreakdown.totalCitations < 10) {
    actions.push('Low total citation count. Publish more FAQ and comparison content optimized for AI extraction.')
  }

  if (actions.length === 0) {
    actions.push('Your citation profile is competitive. Maintain current strategy and expand to new content topics.')
  }

  return actions.slice(0, 5)
}
