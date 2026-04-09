const SERPER_API_URL = 'https://google.serper.dev/search'

export interface SerperResult {
  keyword: string
  position: number | null
  topCompetitorName: string | null
  topCompetitorRank: number | null
  monthlyVolume: number | null
}

/**
 * Search for a keyword and find where a domain ranks.
 */
export async function searchKeyword(
  keyword: string,
  clientDomain: string,
  competitorDomains: string[]
): Promise<SerperResult> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    return { keyword, position: null, topCompetitorName: null, topCompetitorRank: null, monthlyVolume: null }
  }

  try {
    const res = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: keyword, gl: 'us', hl: 'en', num: 20 }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return { keyword, position: null, topCompetitorName: null, topCompetitorRank: null, monthlyVolume: null }
    }

    const data = await res.json()
    const organic = data.organic || []

    const clientDomainLower = clientDomain.toLowerCase().replace(/^www\./, '')
    let position: number | null = null
    for (const result of organic) {
      const linkDomain = (result.link || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
      if (linkDomain.includes(clientDomainLower) || clientDomainLower.includes(linkDomain)) {
        position = result.position || null
        break
      }
    }

    let topCompetitorName: string | null = null
    let topCompetitorRank: number | null = null
    for (const result of organic) {
      const linkDomain = (result.link || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
      for (const compDomain of competitorDomains) {
        const comp = compDomain.toLowerCase().replace(/^www\./, '')
        if (linkDomain.includes(comp) || comp.includes(linkDomain)) {
          topCompetitorName = result.title || compDomain
          topCompetitorRank = result.position || null
          break
        }
      }
      if (topCompetitorName) break
    }

    return {
      keyword,
      position,
      topCompetitorName,
      topCompetitorRank,
      monthlyVolume: data.searchParameters?.searchVolume || null,
    }
  } catch {
    return { keyword, position: null, topCompetitorName: null, topCompetitorRank: null, monthlyVolume: null }
  }
}

/**
 * Generate industry-specific seed keywords.
 */
export function generateSeedKeywords(industry: string | null, clientName: string): string[] {
  const ind = (industry || clientName).toLowerCase().trim()
  return [
    `best ${ind}`,
    `${ind} services`,
    `${ind} near me`,
    `top ${ind} companies`,
    `${ind} reviews`,
    `${ind} pricing`,
    `best ${ind} for small business`,
    `${ind} vs`,
  ]
}

/**
 * Discover keywords for a client by searching industry seed queries.
 */
export async function discoverKeywords(
  domain: string,
  industry: string | null,
  clientName: string
): Promise<string[]> {
  const apiKey = process.env.SERPER_API_KEY
  const seeds = generateSeedKeywords(industry, clientName)

  if (!apiKey) {
    // No API key — return seed keywords so they can be saved with null ranks
    return seeds.slice(0, 8)
  }

  const keywords = new Set<string>()
  for (const seed of seeds) {
    keywords.add(seed)
  }

  // Search a couple seeds to get People Also Ask keywords
  for (const q of seeds.slice(0, 2)) {
    try {
      const res = await fetch(SERPER_API_URL, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'us', hl: 'en' }),
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) continue
      const data = await res.json()

      const paa = data.peopleAlsoAsk || []
      for (const p of paa) {
        if (p.question) keywords.add(p.question)
      }
    } catch {
      continue
    }
  }

  return Array.from(keywords).slice(0, 10)
}
