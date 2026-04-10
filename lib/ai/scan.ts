import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from './models'
import { detectBrandMention, detectCompetitorMentions, analyzeResponseQuality } from './analyze'

export interface ScanResultRow {
  model: 'chatgpt' | 'claude' | 'gemini'
  mentioned: boolean
  mention_position: number | null
  mention_quality: string | null
  authority_score: number | null
  recommendation_strength: string | null
  why_competitor_wins: string | null
  citation_sources: string[]
  citation_source_types: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
  response_excerpt: string
  competitor_mentions: string[]
}

async function queryChatGPT(promptText: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await openai.chat.completions.create({
    model: MODELS.openai,
    messages: [{ role: 'user', content: promptText }],
    max_tokens: 1024,
  })
  return response.choices[0]?.message?.content || ''
}

async function queryClaude(promptText: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await anthropic.messages.create({
    model: MODELS.haiku,
    max_tokens: 1024,
    messages: [{ role: 'user', content: promptText }],
  })
  const block = response.content[0]
  return block.type === 'text' ? block.text : ''
}

async function queryGemini(promptText: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  const result = await model.generateContent(promptText)
  return result.response.text()
}

/**
 * Scan a single prompt across all 3 AI models.
 * Returns one result per model with Claude-powered quality analysis.
 */
export async function scanPrompt(
  promptText: string,
  brandName: string,
  competitorNames: string[]
): Promise<ScanResultRow[]> {
  const queries: { model: ScanResultRow['model']; fn: () => Promise<string> }[] = [
    { model: 'chatgpt', fn: () => queryChatGPT(promptText) },
    { model: 'claude', fn: () => queryClaude(promptText) },
    { model: 'gemini', fn: () => queryGemini(promptText) },
  ]

  const responses = await Promise.allSettled(queries.map((q) => q.fn()))

  const results: ScanResultRow[] = []

  for (let i = 0; i < responses.length; i++) {
    const response = responses[i]
    const model = queries[i].model

    if (response.status === 'rejected') {
      console.error(`Scan failed for ${model}:`, response.reason)
      results.push({
        model,
        mentioned: false,
        mention_position: null,
        mention_quality: 'not_mentioned',
        authority_score: 0,
        recommendation_strength: 'none',
        why_competitor_wins: null,
        citation_sources: [],
        citation_source_types: [],
        sentiment: 'neutral',
        response_excerpt: `[Error: ${response.reason?.message || 'Unknown error'}]`,
        competitor_mentions: [],
      })
      continue
    }

    const responseText = response.value
    const excerpt = responseText.slice(0, 500)

    // Run Claude-powered quality analysis
    const quality = await analyzeResponseQuality(responseText, brandName, competitorNames)

    results.push({
      model,
      mentioned: detectBrandMention(responseText, brandName),
      mention_position: quality.mentionPosition,
      mention_quality: quality.mentionQuality,
      authority_score: quality.authorityScore,
      recommendation_strength: quality.recommendationStrength,
      why_competitor_wins: quality.whyCompetitorWins,
      citation_sources: quality.citationSources,
      citation_source_types: quality.citationSourceTypes,
      sentiment: quality.sentiment,
      response_excerpt: excerpt,
      competitor_mentions: detectCompetitorMentions(responseText, competitorNames),
    })
  }

  return results
}
