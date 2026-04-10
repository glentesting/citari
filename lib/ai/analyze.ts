import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from './models'

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ])

/**
 * Simple string-match helpers (still used as fast pre-checks).
 */
export function detectBrandMention(responseText: string, brandName: string): boolean {
  return responseText.toLowerCase().includes(brandName.toLowerCase())
}

export function detectCompetitorMentions(
  responseText: string,
  competitorNames: string[]
): string[] {
  const lower = responseText.toLowerCase()
  return competitorNames.filter((name) => lower.includes(name.toLowerCase()))
}

export function detectMentionPosition(
  responseText: string,
  brandName: string,
  competitorNames: string[]
): number | null {
  const brand = brandName.toLowerCase()
  const lower = responseText.toLowerCase()
  if (!lower.includes(brand)) return null

  const allBrands = [brandName, ...competitorNames]
  const mentions: { name: string; index: number }[] = []
  for (const name of allBrands) {
    const idx = lower.indexOf(name.toLowerCase())
    if (idx !== -1) {
      mentions.push({ name: name.toLowerCase(), index: idx })
    }
  }
  mentions.sort((a, b) => a.index - b.index)
  const position = mentions.findIndex((m) => m.name === brand)
  return position !== -1 ? position + 1 : null
}

/**
 * Claude-powered response quality analysis.
 */
export interface QualityAnalysis {
  mentionQuality: 'leading' | 'supporting' | 'mentioned' | 'not_mentioned'
  mentionPosition: number | null
  authorityScore: number // 1-10
  recommendationStrength: 'primary' | 'secondary' | 'alternative' | 'none'
  whyCompetitorWins: string | null
  citationSources: string[]
  citationSourceTypes: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
}

export async function analyzeResponseQuality(
  responseText: string,
  brandName: string,
  competitorNames: string[],
  clientContext?: string
): Promise<QualityAnalysis> {
  const isMentioned = detectBrandMention(responseText, brandName)
  const mentionedCompetitors = detectCompetitorMentions(responseText, competitorNames)

  // ALWAYS analyze with Claude — non-mentions are the most valuable data
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const brandContext = clientContext
      ? `\n\nBrand context: ${clientContext}`
      : ''

    const mentionStatus = isMentioned
      ? `The brand IS mentioned in this response.`
      : `The brand is NOT mentioned. ${mentionedCompetitors.length > 0 ? `But these competitors ARE: ${mentionedCompetitors.join(', ')}.` : ''} Analyze WHY the brand was excluded and who was recommended instead.`

    const response = await withTimeout(anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 800,
      system: `You are analyzing an AI model's response for competitive brand visibility.

Brand: "${brandName}"${brandContext}
Competitors: ${competitorNames.join(', ') || 'none specified'}
${mentionStatus}

Return ONLY valid JSON:
{
  "mentionQuality": "leading" | "supporting" | "mentioned" | "not_mentioned",
  "mentionPosition": integer (1=first brand mentioned, null if not mentioned),
  "authorityScore": 1-10 (10=primary recommendation, 0=not mentioned at all),
  "recommendationStrength": "primary" | "secondary" | "alternative" | "none",
  "whyCompetitorWins": "2-3 sentences: Who was recommended instead? What specific advantage do they have? What content or authority signal gave them the edge? What should the brand do to compete on this query?" (null ONLY if brand is the primary recommendation),
  "citationSources": ["source domains or platforms mentioned/implied"],
  "citationSourceTypes": ["own_website" | "review_site" | "press" | "social" | "directory" | "academic"],
  "sentiment": "positive" | "neutral" | "negative"
}`,
      messages: [{
        role: 'user',
        content: `Analyze this AI response (full text):\n\n${responseText}`,
      }],
    }), 15000)

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return {
        mentionQuality: parsed.mentionQuality || (isMentioned ? 'mentioned' : 'not_mentioned'),
        mentionPosition: parsed.mentionPosition ?? null,
        authorityScore: Math.min(10, Math.max(0, parsed.authorityScore || 0)),
        recommendationStrength: parsed.recommendationStrength || 'none',
        whyCompetitorWins: parsed.whyCompetitorWins || null,
        citationSources: Array.isArray(parsed.citationSources) ? parsed.citationSources : [],
        citationSourceTypes: Array.isArray(parsed.citationSourceTypes) ? parsed.citationSourceTypes : [],
        sentiment: parsed.sentiment || 'neutral',
      }
    }
  } catch (e) {
    console.error('Quality analysis failed:', e)
  }

  // Fallback: simple detection
  return {
    mentionQuality: isMentioned ? 'mentioned' : 'not_mentioned',
    mentionPosition: detectMentionPosition(responseText, brandName, competitorNames),
    authorityScore: isMentioned ? 5 : 0,
    recommendationStrength: isMentioned ? 'alternative' : 'none',
    whyCompetitorWins: !isMentioned && mentionedCompetitors.length > 0
      ? `${mentionedCompetitors.join(', ')} mentioned instead of ${brandName}`
      : null,
    citationSources: [],
    citationSourceTypes: [],
    sentiment: 'neutral',
  }
}
