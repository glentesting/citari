import { fetchWithTimeout } from '@/lib/utils'

export interface GMBLocation {
  name: string
  locationId: string
  businessName: string
  address: string
  phone: string
  websiteUrl: string
  categories: string[]
  isVerified: boolean
}

export interface GMBReview {
  reviewId: string
  rating: number
  comment: string
  author: string
  createTime: string
}

export interface GMBInsights {
  reviewCount: number
  averageRating: number
  photoCount: number
  totalSearches: number
}

export async function getGMBLocations(accessToken: string): Promise<GMBLocation[]> {
  try {
    const accountsRes = await fetchWithTimeout('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeoutMs: 10000,
    })
    if (!accountsRes.ok) return []
    const accounts = await accountsRes.json()
    const accountName = accounts.accounts?.[0]?.name
    if (!accountName) return []

    const locationsRes = await fetchWithTimeout(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,categories,metadata`,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeoutMs: 10000 }
    )
    if (!locationsRes.ok) return []
    const locData = await locationsRes.json()

    return (locData.locations || []).map((loc: any) => ({
      name: loc.name,
      locationId: loc.name?.split('/').pop() || '',
      businessName: loc.title || '',
      address: loc.storefrontAddress?.addressLines?.join(', ') || '',
      phone: loc.phoneNumbers?.primaryPhone || '',
      websiteUrl: loc.websiteUri || '',
      categories: [loc.categories?.primaryCategory?.displayName, ...(loc.categories?.additionalCategories?.map((c: any) => c.displayName) || [])].filter(Boolean),
      isVerified: loc.metadata?.hasVoiceOfMerchant || false,
    }))
  } catch (e) {
    console.error('Failed to fetch GMB locations:', e)
    return []
  }
}

export async function getGMBReviews(accessToken: string, locationName: string): Promise<GMBReview[]> {
  try {
    const res = await fetchWithTimeout(
      `https://mybusiness.googleapis.com/v4/${locationName}/reviews`,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeoutMs: 10000 }
    )
    if (!res.ok) return []
    const data = await res.json()

    return (data.reviews || []).map((r: any) => ({
      reviewId: r.reviewId || '',
      rating: r.starRating === 'FIVE' ? 5 : r.starRating === 'FOUR' ? 4 : r.starRating === 'THREE' ? 3 : r.starRating === 'TWO' ? 2 : 1,
      comment: r.comment || '',
      author: r.reviewer?.displayName || 'Anonymous',
      createTime: r.createTime || '',
    }))
  } catch (e) {
    console.error('Failed to fetch GMB reviews:', e)
    return []
  }
}

export async function generateGMBResponseTemplate(
  review: { rating: number; comment: string; author: string },
  businessName: string,
  tone: 'professional' | 'friendly' | 'empathetic'
): Promise<string> {
  // Returns a template — Claude-powered response generation would be added via the existing AI infrastructure
  if (review.rating >= 4) {
    return `Thank you so much for your kind words, ${review.author}! We're thrilled to hear about your experience with ${businessName}. Your feedback means the world to our team. We look forward to serving you again!`
  }
  if (review.rating === 3) {
    return `Thank you for your feedback, ${review.author}. We appreciate you taking the time to share your experience with ${businessName}. We'd love to hear more about how we can improve — please feel free to reach out to us directly.`
  }
  return `We're sorry to hear about your experience, ${review.author}. This isn't the standard we hold ourselves to at ${businessName}. We'd like to make this right — please contact us directly so we can address your concerns.`
}

/**
 * Calculate a GMB health score (0-100) based on profile completeness and activity.
 */
export function calculateGMBHealthScore(data: {
  reviewCount: number
  averageRating: number
  photoCount: number
  isVerified: boolean
  categoryCount: number
}): number {
  let score = 0

  // Verification (20 points)
  if (data.isVerified) score += 20

  // Reviews (30 points)
  if (data.reviewCount >= 100) score += 30
  else if (data.reviewCount >= 50) score += 25
  else if (data.reviewCount >= 20) score += 20
  else if (data.reviewCount >= 5) score += 10
  else score += data.reviewCount * 2

  // Rating (20 points)
  if (data.averageRating >= 4.5) score += 20
  else if (data.averageRating >= 4.0) score += 15
  else if (data.averageRating >= 3.5) score += 10
  else score += 5

  // Photos (15 points)
  if (data.photoCount >= 20) score += 15
  else if (data.photoCount >= 10) score += 10
  else score += Math.min(data.photoCount, 5) * 2

  // Categories (15 points)
  if (data.categoryCount >= 3) score += 15
  else score += data.categoryCount * 5

  return Math.min(100, score)
}
