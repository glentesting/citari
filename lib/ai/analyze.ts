/**
 * Detect brand mentions, competitor mentions, and sentiment in AI response text.
 * Uses simple string matching — can be refined later with NLP.
 */

export function detectBrandMention(responseText: string, brandName: string): boolean {
  const lower = responseText.toLowerCase()
  const brand = brandName.toLowerCase()
  return lower.includes(brand)
}

export function detectCompetitorMentions(
  responseText: string,
  competitorNames: string[]
): string[] {
  const lower = responseText.toLowerCase()
  return competitorNames.filter((name) => lower.includes(name.toLowerCase()))
}

/**
 * Detect the position of a brand mention among all brand/company mentions in the response.
 * Returns 1 if mentioned first, 2 if second, etc. Returns null if not mentioned.
 */
export function detectMentionPosition(
  responseText: string,
  brandName: string,
  competitorNames: string[]
): number | null {
  const brand = brandName.toLowerCase()
  const lower = responseText.toLowerCase()

  if (!lower.includes(brand)) return null

  // Collect all known brand names (client + competitors)
  const allBrands = [brandName, ...competitorNames]

  // Find the first occurrence index of each brand
  const mentions: { name: string; index: number }[] = []
  for (const name of allBrands) {
    const idx = lower.indexOf(name.toLowerCase())
    if (idx !== -1) {
      mentions.push({ name: name.toLowerCase(), index: idx })
    }
  }

  // Sort by position in text
  mentions.sort((a, b) => a.index - b.index)

  // Find our brand's position (1-indexed)
  const position = mentions.findIndex((m) => m.name === brand)
  return position !== -1 ? position + 1 : null
}

export function detectSentiment(
  responseText: string,
  brandName: string
): 'positive' | 'neutral' | 'negative' {
  const lower = responseText.toLowerCase()
  const brand = brandName.toLowerCase()

  if (!lower.includes(brand)) return 'neutral'

  // Find sentences containing the brand name
  const sentences = responseText.split(/[.!?]+/)
  const brandSentences = sentences.filter((s) =>
    s.toLowerCase().includes(brand)
  )

  const positiveWords = [
    'best', 'leading', 'top', 'excellent', 'great', 'outstanding',
    'innovative', 'reliable', 'trusted', 'recommended', 'popular',
    'powerful', 'superior', 'impressive', 'award', 'renowned',
    'preferred', 'notable', 'strong', 'well-known', 'highly rated',
  ]
  const negativeWords = [
    'worst', 'poor', 'bad', 'lacking', 'limited', 'expensive',
    'outdated', 'slow', 'unreliable', 'complaints', 'issues',
    'drawback', 'weakness', 'inferior', 'disappointing', 'behind',
    'struggling', 'controversial', 'criticized',
  ]

  let positiveScore = 0
  let negativeScore = 0

  for (const sentence of brandSentences) {
    const s = sentence.toLowerCase()
    for (const word of positiveWords) {
      if (s.includes(word)) positiveScore++
    }
    for (const word of negativeWords) {
      if (s.includes(word)) negativeScore++
    }
  }

  if (positiveScore > negativeScore) return 'positive'
  if (negativeScore > positiveScore) return 'negative'
  return 'neutral'
}
