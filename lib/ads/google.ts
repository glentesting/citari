/**
 * Google Ads Transparency Center API
 * Public API — no key required.
 * Fetches ads for a given advertiser domain.
 */

export interface GoogleAd {
  ad_text: string
  ad_url: string
  first_seen: string
  last_seen: string
  format: string
}

export async function fetchGoogleAds(domain: string): Promise<GoogleAd[]> {
  // Google Ads Transparency Center doesn't have a direct public REST API
  // for programmatic access. We scrape the transparency center page.
  // For production, consider using the Google Ads API with proper auth.

  try {
    const url = `https://adstransparency.google.com/advertiser/${encodeURIComponent(domain)}`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) return []

    const html = await res.text()

    // Extract ad data from page (simplified extraction)
    // In production, this would use a proper parser or the official API
    const ads: GoogleAd[] = []

    // Look for ad creative text in the page
    const adBlocks = html.match(/class="[^"]*ad-creative[^"]*"[^>]*>[\s\S]*?<\/div>/gi) || []

    for (const block of adBlocks.slice(0, 20)) {
      const textMatch = block.match(/>([^<]{20,})</)?.[1]
      if (textMatch) {
        ads.push({
          ad_text: textMatch.trim(),
          ad_url: `https://adstransparency.google.com/advertiser/${domain}`,
          first_seen: new Date().toISOString().split('T')[0],
          last_seen: new Date().toISOString().split('T')[0],
          format: 'text',
        })
      }
    }

    return ads
  } catch {
    return []
  }
}
