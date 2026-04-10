const MAX_PAGES = 20
const FETCH_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Citari/1.0)' }

/**
 * Try to find content URLs for a domain.
 * Strategy: sitemap.xml first, then scrape homepage links as fallback.
 */
export async function crawlCompetitorSitemap(domain: string): Promise<string[]> {
  // 1. Try sitemap
  const sitemapUrls = await trySitemap(domain)
  if (sitemapUrls.length > 0) return sitemapUrls

  // 2. Fallback: scrape links from the homepage
  const homepageUrls = await scrapeHomepageLinks(domain)
  if (homepageUrls.length > 0) return homepageUrls

  // 3. Last resort: try common blog paths directly
  const commonPaths = ['/blog', '/news', '/articles', '/resources', '/insights']
  const foundUrls: string[] = []
  for (const path of commonPaths) {
    for (const prefix of [`https://${domain}`, `https://www.${domain}`]) {
      try {
        const res = await fetch(`${prefix}${path}`, {
          headers: FETCH_HEADERS,
          signal: AbortSignal.timeout(8000),
          redirect: 'follow',
        })
        if (res.ok) {
          foundUrls.push(res.url)
          // Scrape links from this page too
          const html = await res.text()
          const hrefMatches = html.match(/href="([^"]+)"/g) || []
          const finalDomain = new URL(res.url).hostname
          for (const match of hrefMatches.slice(0, 30)) {
            const href = match.slice(6, -1)
            if (href.startsWith('/') && !href.startsWith('//')) {
              foundUrls.push(`https://${finalDomain}${href}`)
            }
          }
          if (foundUrls.length >= 5) break
        }
      } catch (e) { console.error(`Crawl failed for path ${path}:`, e); continue }
    }
    if (foundUrls.length >= 5) break
  }

  return [...new Set(foundUrls)].slice(0, MAX_PAGES)
}

async function trySitemap(domain: string): Promise<string[]> {
  const candidates = [
    `https://${domain}/sitemap.xml`,
    `https://www.${domain}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`,
    `https://${domain}/post-sitemap.xml`,
    `https://${domain}/page-sitemap.xml`,
    `https://www.${domain}/sitemap_index.xml`,
  ]

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      })

      if (!res.ok) continue

      const xml = await res.text()

      // Check for sitemap index (links to other sitemaps)
      if (xml.includes('<sitemapindex')) {
        const sitemapLocs = xml.match(/<loc>(.*?)<\/loc>/g)
        if (sitemapLocs) {
          // Fetch the first child sitemap
          for (const loc of sitemapLocs.slice(0, 3)) {
            const childUrl = loc.replace(/<\/?loc>/g, '')
            const childUrls = await fetchSitemapUrls(childUrl)
            if (childUrls.length > 0) return childUrls
          }
        }
        continue
      }

      const urls = extractSitemapUrls(xml)
      if (urls.length > 0) return urls
    } catch (e) {
      console.error(`Sitemap parse failed for ${url}:`, e)
      continue
    }
  }

  return []
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  try {
    const res = await fetch(sitemapUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    })
    if (!res.ok) return []
    const xml = await res.text()
    return extractSitemapUrls(xml)
  } catch (e) {
    console.error(`Failed to fetch sitemap URLs from ${sitemapUrl}:`, e)
    return []
  }
}

function extractSitemapUrls(xml: string): string[] {
  const urlMatches = xml.match(/<loc>(.*?)<\/loc>/g)
  if (!urlMatches) return []

  const allUrls = urlMatches
    .map((match) => match.replace(/<\/?loc>/g, ''))
    .filter((u) => !u.match(/\.(jpg|jpeg|png|gif|css|js|xml|pdf|svg|webp|mp4|zip)$/i))

  // Prioritize content pages
  const contentUrls = allUrls.filter((u) => {
    const lower = u.toLowerCase()
    return (
      lower.includes('/blog') ||
      lower.includes('/article') ||
      lower.includes('/post') ||
      lower.includes('/resource') ||
      lower.includes('/guide') ||
      lower.includes('/learn') ||
      lower.includes('/insights') ||
      lower.includes('/news') ||
      lower.includes('/case-stud') ||
      lower.includes('/whitepaper') ||
      lower.includes('/help') ||
      lower.includes('/docs')
    )
  })

  // Use content URLs if found, otherwise take all non-asset URLs
  return (contentUrls.length > 0 ? contentUrls : allUrls).slice(0, MAX_PAGES)
}

/**
 * Fallback: fetch the homepage and extract internal links.
 */
async function scrapeHomepageLinks(domain: string): Promise<string[]> {
  const homeUrls = [`https://${domain}`, `https://www.${domain}`]

  for (const homeUrl of homeUrls) {
    try {
      const res = await fetch(homeUrl, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      })

      if (!res.ok) continue

      const html = await res.text()
      const finalDomain = new URL(res.url).hostname

      // Extract all href values
      const hrefMatches = html.match(/href="([^"]+)"/g) || []
      const urls = new Set<string>()

      for (const match of hrefMatches) {
        const href = match.slice(6, -1) // strip href=" and "

        let fullUrl: string
        if (href.startsWith('http')) {
          fullUrl = href
        } else if (href.startsWith('/') && !href.startsWith('//')) {
          fullUrl = `https://${finalDomain}${href}`
        } else {
          continue
        }

        // Only keep internal links
        try {
          const parsed = new URL(fullUrl)
          if (!parsed.hostname.includes(domain.replace('www.', ''))) continue

          // Skip non-content paths
          const path = parsed.pathname.toLowerCase()
          if (
            path === '/' ||
            path.includes('login') ||
            path.includes('signup') ||
            path.includes('cart') ||
            path.includes('checkout') ||
            path.includes('account') ||
            path.includes('privacy') ||
            path.includes('terms') ||
            path.includes('cookie') ||
            path.match(/\.(jpg|png|gif|css|js|pdf|svg)$/)
          ) continue

          urls.add(parsed.origin + parsed.pathname)
        } catch (e) {
          console.error('Failed to parse URL:', href, e)
          continue
        }
      }

      if (urls.size > 0) {
        const urlArray = Array.from(urls)

        // Prioritize content-looking paths
        const content = urlArray.filter((u) => {
          const lower = u.toLowerCase()
          return (
            lower.includes('/blog') || lower.includes('/article') ||
            lower.includes('/post') || lower.includes('/resource') ||
            lower.includes('/about') || lower.includes('/service') ||
            lower.includes('/product') || lower.includes('/solution') ||
            lower.includes('/case') || lower.includes('/news')
          )
        })

        return (content.length > 0 ? content : urlArray).slice(0, MAX_PAGES)
      }
    } catch (e) {
      console.error(`Failed to scrape homepage ${homeUrl}:`, e)
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
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
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
  } catch (e) {
    console.error(`Failed to fetch page content from ${url}:`, e)
    return null
  }
}
