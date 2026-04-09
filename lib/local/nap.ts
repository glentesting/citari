export interface NAPCheck {
  directory: string
  listed_name: string | null
  listed_address: string | null
  listed_phone: string | null
  listed_website: string | null
  is_consistent: boolean
  issues: string[]
}

export interface ClientNAP {
  name: string
  address?: string
  phone?: string
  website?: string
}

/**
 * Check NAP consistency across directories by searching for the business.
 * Uses Serper.dev to find directory listings.
 */
export async function checkNAPConsistency(
  clientNAP: ClientNAP
): Promise<NAPCheck[]> {
  const apiKey = process.env.SERPER_API_KEY
  const results: NAPCheck[] = []

  const directories = [
    { name: 'Google Business', query: `"${clientNAP.name}" site:google.com/maps` },
    { name: 'Yelp', query: `"${clientNAP.name}" site:yelp.com` },
    { name: 'Facebook', query: `"${clientNAP.name}" site:facebook.com` },
    { name: 'Yellow Pages', query: `"${clientNAP.name}" site:yellowpages.com` },
    { name: 'BBB', query: `"${clientNAP.name}" site:bbb.org` },
    { name: 'Bing Places', query: `"${clientNAP.name}" site:bing.com/maps` },
  ]

  for (const dir of directories) {
    if (!apiKey) {
      results.push({
        directory: dir.name,
        listed_name: null,
        listed_address: null,
        listed_phone: null,
        listed_website: null,
        is_consistent: false,
        issues: ['Serper API key not configured — unable to check'],
      })
      continue
    }

    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: dir.query, gl: 'us', hl: 'en', num: 3 }),
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) {
        results.push({
          directory: dir.name,
          listed_name: null, listed_address: null, listed_phone: null, listed_website: null,
          is_consistent: false,
          issues: ['Search failed'],
        })
        continue
      }

      const data = await res.json()
      const organic = data.organic || []
      const found = organic.length > 0

      if (!found) {
        results.push({
          directory: dir.name,
          listed_name: null, listed_address: null, listed_phone: null, listed_website: null,
          is_consistent: false,
          issues: ['Not found in this directory'],
        })
        continue
      }

      // Extract what we can from the search snippet
      const snippet = organic[0]?.snippet || ''
      const title = organic[0]?.title || ''

      const issues: string[] = []
      const listedName = title.split(' - ')[0]?.split(' | ')[0]?.trim() || null

      // Check name consistency
      if (listedName && !listedName.toLowerCase().includes(clientNAP.name.toLowerCase()) &&
          !clientNAP.name.toLowerCase().includes(listedName.toLowerCase())) {
        issues.push(`Name mismatch: "${listedName}" vs "${clientNAP.name}"`)
      }

      // Check if phone appears
      const phoneMatch = snippet.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
      const listedPhone = phoneMatch ? phoneMatch[0] : null
      if (clientNAP.phone && listedPhone) {
        const normalizedClient = clientNAP.phone.replace(/\D/g, '')
        const normalizedListed = listedPhone.replace(/\D/g, '')
        if (normalizedClient !== normalizedListed) {
          issues.push(`Phone mismatch: "${listedPhone}" vs "${clientNAP.phone}"`)
        }
      }

      results.push({
        directory: dir.name,
        listed_name: listedName,
        listed_address: null, // Would need deeper scraping
        listed_phone: listedPhone,
        listed_website: organic[0]?.link || null,
        is_consistent: issues.length === 0,
        issues,
      })
    } catch {
      results.push({
        directory: dir.name,
        listed_name: null, listed_address: null, listed_phone: null, listed_website: null,
        is_consistent: false,
        issues: ['Check failed'],
      })
    }
  }

  return results
}

export function calculateNAPScore(checks: NAPCheck[]): number {
  if (checks.length === 0) return 0
  const consistent = checks.filter((c) => c.is_consistent).length
  return Math.round((consistent / checks.length) * 100)
}
