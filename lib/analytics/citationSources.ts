import { SupabaseClient } from '@supabase/supabase-js'

export interface CitationSourceBreakdown {
  brandName: string
  sources: { source: string; type: string; count: number; percentage: number }[]
  totalCitations: number
  recommendation: string
}

export interface CitationHitListItem {
  platform: string
  type: string
  competitors_on_it: string[]
  client_present: boolean
  priority: 'high' | 'medium' | 'low'
  action: string
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

  const typeBreakdown = new Map<string, number>()
  for (const s of sources) {
    typeBreakdown.set(s.type, (typeBreakdown.get(s.type) || 0) + s.count)
  }

  let recommendation = ''
  const reviewSite = typeBreakdown.get('review_site') || 0
  const press = typeBreakdown.get('press') || 0

  if (totalCitations === 0) {
    recommendation = "Your content isn't being cited yet. Focus on structured FAQ content and getting listed on review platforms."
  } else if (reviewSite === 0) {
    recommendation = 'You have zero review site citations. Getting listed on industry review platforms could significantly increase AI authority.'
  } else if (press === 0) {
    recommendation = 'No press citations detected. Getting featured in industry publications could boost your authority score.'
  } else {
    recommendation = 'Good citation diversity. Focus on increasing volume across your strongest citation sources.'
  }

  return { brandName: clientName, sources, totalCitations, recommendation }
}

/**
 * Build a cross-competitor citation hit list.
 * Shows specific platforms competitors are cited from that the client isn't on.
 */
export async function buildCitationHitList(
  supabase: SupabaseClient,
  clientId: string
): Promise<CitationHitListItem[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Get all scan results with citation data
  const { data: scans } = await supabase
    .from('scan_results')
    .select('citation_sources, citation_source_types, competitor_mentions, mentioned')
    .eq('client_id', clientId)
    .gte('scanned_at', thirtyDaysAgo.toISOString())

  if (!scans || scans.length === 0) return []

  // Get competitor names
  const { data: competitors } = await supabase
    .from('competitors')
    .select('name')
    .eq('client_id', clientId)

  const compNames = (competitors || []).map((c) => c.name)

  // Build maps: platform → which competitors are cited from it
  const clientSources = new Set<string>()
  const competitorSources = new Map<string, { type: string; competitors: Set<string> }>()

  for (const scan of scans) {
    const sources = scan.citation_sources || []
    const types = scan.citation_source_types || []
    const mentioned = scan.mentioned
    const compMentions = scan.competitor_mentions || []

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]?.toLowerCase().trim()
      const type = types[i] || 'unknown'
      if (!source) continue

      if (mentioned) {
        clientSources.add(source)
      }

      // Check which competitors are mentioned in scans citing this source
      for (const compName of compNames) {
        if (compMentions.includes(compName)) {
          const existing = competitorSources.get(source)
          if (existing) {
            existing.competitors.add(compName)
          } else {
            competitorSources.set(source, { type, competitors: new Set([compName]) })
          }
        }
      }
    }
  }

  // Known platform signup links
  const platformLinks: Record<string, string> = {
    'g2': 'https://www.g2.com/products/new',
    'capterra': 'https://www.capterra.com/vendors/sign-up',
    'trustpilot': 'https://business.trustpilot.com/signup',
    'google': 'https://business.google.com',
    'yelp': 'https://biz.yelp.com/signup',
    'avvo': 'https://www.avvo.com/for-lawyers',
    'martindale': 'https://www.martindale.com/attorneys',
    'bbb': 'https://www.bbb.org/get-accredited',
    'clutch': 'https://clutch.co/vendors/apply',
    'glassdoor': 'https://www.glassdoor.com/employers',
  }

  // Build hit list — platforms competitors use that client doesn't
  const hitList: CitationHitListItem[] = []

  for (const [platform, data] of competitorSources) {
    const clientPresent = clientSources.has(platform)
    const competitorsOnIt = [...data.competitors]

    // Determine priority
    let priority: 'high' | 'medium' | 'low' = 'low'
    if (!clientPresent && competitorsOnIt.length >= 2) priority = 'high'
    else if (!clientPresent && competitorsOnIt.length === 1) priority = 'medium'

    // Find matching signup link
    const platformKey = Object.keys(platformLinks).find((k) => platform.includes(k))
    const signupLink = platformKey ? platformLinks[platformKey] : null

    hitList.push({
      platform,
      type: data.type,
      competitors_on_it: competitorsOnIt,
      client_present: clientPresent,
      priority,
      action: !clientPresent
        ? `Get listed on ${platform}.${signupLink ? ` Sign up: ${signupLink}` : ''}`
        : 'Already present — maintain and grow.',
    })
  }

  return hitList
    .filter((item) => !item.client_present)
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.priority] - order[b.priority]
    })
    .slice(0, 10)
}
