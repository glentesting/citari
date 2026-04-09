const MAX_PAGES = 20

/**
 * Fetch and parse a competitor's sitemap.xml to extract content URLs.
 */
export async function crawlCompetitorSitemap(domain: string): Promise<string[]> {
  const sitemapUrls = [
    `https://${domain}/sitemap.xml`,
    `https://www.${domain}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`,
  ]

  for (const url of sitemapUrls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Citari Bot/1.0 (competitive research)' },
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) continue

      const xml = await res.text()

      // Extract URLs from sitemap
      const urlMatches = xml.match(/<loc>(.*?)<\/loc>/g)
      if (!urlMatches) continue

      const urls = urlMatches
        .map((match) => match.replace(/<\/?loc>/g, ''))
        .filter((u) => {
          const lower = u.toLowerCase()
          // Prioritize blog/content pages
          return (
            lower.includes('/blog') ||
            lower.includes('/article') ||
            lower.includes('/post') ||
            lower.includes('/resource') ||
            lower.includes('/guide') ||
            lower.includes('/learn') ||
            lower.includes('/insights') ||
            lower.includes('/news')
          )
        })
        .slice(0, MAX_PAGES)

      // If no content pages found, take the first MAX_PAGES URLs
      if (urls.length === 0) {
        return urlMatches
          .map((match) => match.replace(/<\/?loc>/g, ''))
          .filter((u) => !u.match(/\.(jpg|png|gif|css|js|xml|pdf)$/i))
          .slice(0, MAX_PAGES)
      }

      return urls
    } catch {
      continue
    }
  }

  return []
}

export interface PageContent {
  url: string
  title: string
  excerpt: string
}

/**
 * Fetch a page and extract title + first ~500 words of content.
 */
export async function fetchPageContent(url: string): Promise<PageContent | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Citari Bot/1.0 (competitive research)' },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return null

    const html = await res.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const title = titleMatch
      ? titleMatch[1].replace(/\s+/g, ' ').trim()
      : url.split('/').pop() || url

    // Extract text content: strip tags, collapse whitespace
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const bodyHtml = bodyMatch ? bodyMatch[1] : html

    const text = bodyHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // First ~500 words
    const words = text.split(' ')
    const excerpt = words.slice(0, 500).join(' ')

    return { url, title, excerpt }
  } catch {
    return null
  }
}
