export interface ReviewData {
  platform: string
  rating: number
  review_text: string
  author: string
  reviewed_at: string | null
}

export async function fetchYelpReviews(businessId: string): Promise<ReviewData[]> {
  const apiKey = process.env.YELP_API_KEY
  if (!apiKey) return []

  try {
    const res = await fetch(`https://api.yelp.com/v3/businesses/${businessId}/reviews?limit=20&sort_by=newest`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()

    return (data.reviews || []).map((r: any) => ({
      platform: 'yelp',
      rating: r.rating,
      review_text: r.text || '',
      author: r.user?.name || 'Anonymous',
      reviewed_at: r.time_created?.split(' ')[0] || null,
    }))
  } catch (e) {
    console.error('Failed to fetch Yelp reviews:', e)
    return []
  }
}

export async function fetchYelpBusinessId(businessName: string, location: string): Promise<string | null> {
  const apiKey = process.env.YELP_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(
      `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(businessName)}&location=${encodeURIComponent(location)}&limit=1`,
      { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.businesses?.[0]?.id || null
  } catch (e) {
    console.error('Failed to fetch Yelp business ID:', e)
    return null
  }
}

/**
 * Scrape public G2 review summary for a product.
 */
export async function fetchG2Reviews(productSlug: string): Promise<ReviewData[]> {
  try {
    const res = await fetch(`https://www.g2.com/products/${productSlug}/reviews`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Citari/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const html = await res.text()

    const reviews: ReviewData[] = []
    const ratingMatches = html.match(/stars-(\d)/g) || []
    const textMatches = html.match(/<div[^>]*class="[^"]*review-body[^"]*"[^>]*>([\s\S]*?)<\/div>/gi) || []

    for (let i = 0; i < Math.min(ratingMatches.length, textMatches.length, 10); i++) {
      const rating = parseInt(ratingMatches[i].replace('stars-', ''))
      const text = textMatches[i].replace(/<[^>]+>/g, '').trim().slice(0, 500)
      if (text) {
        reviews.push({ platform: 'g2', rating, review_text: text, author: 'G2 User', reviewed_at: null })
      }
    }
    return reviews
  } catch (e) {
    console.error('Failed to fetch G2 reviews:', e)
    return []
  }
}

/**
 * Analyze review themes using simple keyword extraction.
 */
export function extractReviewThemes(reviews: ReviewData[]): { theme: string; count: number; sentiment: 'positive' | 'negative' }[] {
  const positiveThemes: Record<string, number> = {}
  const negativeThemes: Record<string, number> = {}

  const positiveKeywords = ['easy', 'fast', 'support', 'intuitive', 'reliable', 'value', 'helpful', 'responsive', 'quality', 'professional']
  const negativeKeywords = ['slow', 'expensive', 'confusing', 'buggy', 'limited', 'poor', 'difficult', 'unresponsive', 'lacking', 'frustrating']

  for (const review of reviews) {
    const text = review.review_text.toLowerCase()
    for (const kw of positiveKeywords) {
      if (text.includes(kw)) positiveThemes[kw] = (positiveThemes[kw] || 0) + 1
    }
    for (const kw of negativeKeywords) {
      if (text.includes(kw)) negativeThemes[kw] = (negativeThemes[kw] || 0) + 1
    }
  }

  const themes = [
    ...Object.entries(positiveThemes).map(([theme, count]) => ({ theme, count, sentiment: 'positive' as const })),
    ...Object.entries(negativeThemes).map(([theme, count]) => ({ theme, count, sentiment: 'negative' as const })),
  ]

  return themes.sort((a, b) => b.count - a.count).slice(0, 10)
}
