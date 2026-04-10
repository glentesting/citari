import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from './models'

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
 * Replaces the old keyword-based sentiment detection.
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
  competitorNames: string[]
): Promise<QualityAnalysis> {
  // Fast pre-check
  const isMentioned = detectBrandMention(responseText, brandName)

  if (!isMentioned && competitorNames.length === 0) {
    return {
      mentionQuality: 'not_mentioned',
      mentionPosition: null,
      authorityScore: 0,
      recommendationStrength: 'none',
      whyCompetitorWins: null,
      citationSources: [],
      citationSourceTypes: [],
      sentiment: 'neutral',
    }
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: MODELS.haiku, // fast + cheap for analysis
      max_tokens: 512,
      system: `Analyze an AI model response for brand visibility quality. The brand is "${brandName}". Competitors: ${competitorNames.join(', ') || 'none specified'}.

Return ONLY valid JSON with these fields:
- mentionQuality: "leading" (first/primary recommendation), "supporting" (positive but not primary), "mentioned" (neutral reference), "not_mentioned"
- mentionPosition: integer position among all brands mentioned (1=first, null if not mentioned)
- authorityScore: 1-10 (10 = "the best solution is [brand]", 1 = barely mentioned)
- recommendationStrength: "primary" (the top pick), "secondary" (a strong alternative), "alternative" (one of many options), "none"
- whyCompetitorWins: one sentence explaining WHY a competitor is recommended over the brand, or null if brand leads
- citationSources: array of source domains or platforms detected/implied in the response (e.g. "G2", "Forbes", "company website")
- citationSourceTypes: array of types from: "own_website", "review_site", "press", "social", "directory", "academic"
- sentiment: "positive", "neutral", "negative" toward the brand`,
      messages: [{
        role: 'user',
        content: `Analyze this AI response:\n\n${responseText.slice(0, 2000)}`,
      }],
    })

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
    // Claude analysis failed — fall back to simple detection
    console.error('Quality analysis failed:', e)
  }

  // Fallback: use simple string matching
  return {
    mentionQuality: isMentioned ? 'mentioned' : 'not_mentioned',
    mentionPosition: detectMentionPosition(responseText, brandName, competitorNames),
    authorityScore: isMentioned ? 5 : 0,
    recommendationStrength: isMentioned ? 'alternative' : 'none',
    whyCompetitorWins: null,
    citationSources: [],
    citationSourceTypes: [],
    sentiment: 'neutral',
  }
}
