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
