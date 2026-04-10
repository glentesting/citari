import { fetchWithTimeout } from '@/lib/utils'

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
    const res = await fetchWithTimeout(SERPER_API_URL, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: keyword, gl: 'us', hl: 'en', num: 20 }),
      timeoutMs: 10000,
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
  } catch (e) {
    console.error(`Failed to check SERP ranking for keyword "${keyword}":`, e)
    return { keyword, position: null, topCompetitorName: null, topCompetitorRank: null, monthlyVolume: null }
  }
}

// generateSeedKeywords and discoverKeywords removed — setup route
// uses Claude with full client context for keyword generation instead.
