import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { detectBrandMention, detectCompetitorMentions, detectSentiment } from './analyze'

export interface ScanResultRow {
  model: 'chatgpt' | 'claude' | 'gemini'
  mentioned: boolean
  sentiment: 'positive' | 'neutral' | 'negative'
  response_excerpt: string
  competitor_mentions: string[]
}

async function queryChatGPT(promptText: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: promptText }],
    max_tokens: 1024,
  })

  return response.choices[0]?.message?.content || ''
}

async function queryClaude(promptText: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
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
 * Returns one result per model.
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

  const results = await Promise.allSettled(queries.map((q) => q.fn()))

  return results.map((result, i) => {
    const model = queries[i].model

    if (result.status === 'rejected') {
      console.error(`Scan failed for ${model}:`, result.reason)
      return {
        model,
        mentioned: false,
        sentiment: 'neutral' as const,
        response_excerpt: `[Error: ${result.reason?.message || 'Unknown error'}]`,
        competitor_mentions: [],
      }
    }

    const responseText = result.value
    const excerpt = responseText.slice(0, 500)

    return {
      model,
      mentioned: detectBrandMention(responseText, brandName),
      sentiment: detectSentiment(responseText, brandName),
      response_excerpt: excerpt,
      competitor_mentions: detectCompetitorMentions(responseText, competitorNames),
    }
  })
}
