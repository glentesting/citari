import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from '@/lib/ai/models'

const SYSTEM = 'You are a helpful business advisor. Give detailed, specific answers about companies. Explain their strengths, weaknesses, reputation, and what makes them stand out. Cite any sources or signals you draw on.'

export interface AIAuditResult {
  /** What AI models collectively believe about this competitor */
  aiPerception: string
  /** Specific claims AI models repeat (these have citation weight) */
  repeatedClaims: string[]
  /** Sources AI models reference when discussing this competitor */
  citedSources: string[]
  /** Strengths AI models attribute to this competitor */
  perceivedStrengths: string[]
  /** Weaknesses or gaps AI models mention */
  perceivedWeaknesses: string[]
  /** Raw responses from each model */
  rawResponses: { model: string; question: string; response: string }[]
}

async function queryAll(prompt: string): Promise<{ model: string; response: string }[]> {
  const results: { model: string; response: string }[] = []

  const queries = await Promise.allSettled([
    // ChatGPT
    (async () => {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const res = await openai.chat.completions.create({
        model: MODELS.openai,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
        max_tokens: 1500,
      })
      return { model: 'chatgpt', response: res.choices[0]?.message?.content || '' }
    })(),
    // Claude
    (async () => {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const res = await anthropic.messages.create({
        model: MODELS.haiku,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      })
      return { model: 'claude', response: res.content[0].type === 'text' ? res.content[0].text : '' }
    })(),
    // Gemini
    (async () => {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: SYSTEM })
      const res = await model.generateContent(prompt)
      return { model: 'gemini', response: res.response.text() }
    })(),
  ])

  for (const q of queries) {
    if (q.status === 'fulfilled' && q.value.response) {
      results.push(q.value)
    }
  }

  return results
}

/**
 * Run a full AI audit on a competitor — ask AI models directly about them,
 * then analyze what AI believes, what claims it repeats, and what sources it cites.
 */
export async function runCompetitorAIAudit(
  competitorName: string,
  competitorDomain: string | null,
  clientIndustry: string | null
): Promise<AIAuditResult> {
  const industry = clientIndustry || 'their industry'
  const domain = competitorDomain ? ` (${competitorDomain})` : ''

  // 5 direct questions about the competitor across all 3 AI models
  const questions = [
    `Tell me about ${competitorName}${domain}. What do they do and what are they known for?`,
    `What are the strengths of ${competitorName} compared to other ${industry} firms?`,
    `Why would someone choose ${competitorName} over their competitors?`,
    `What do clients say about ${competitorName}? What is their reputation?`,
    `What are the weaknesses or limitations of ${competitorName}?`,
  ]

  const allRaw: AIAuditResult['rawResponses'] = []

  // Run questions in parallel batches of 2 (each hits 3 models = 6 concurrent)
  for (let i = 0; i < questions.length; i += 2) {
    const batch = questions.slice(i, i + 2)
    const batchResults = await Promise.all(
      batch.map(async (q) => {
        const responses = await queryAll(q)
        return responses.map((r) => ({ ...r, question: q }))
      })
    )
    for (const results of batchResults) {
      allRaw.push(...results)
    }
  }

  // Now analyze all responses with Claude to extract structured intelligence
  const allText = allRaw
    .map((r) => `[${r.model}] Q: ${r.question}\nA: ${r.response.slice(0, 500)}`)
    .join('\n\n---\n\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const analysis = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 1500,
    system: `Analyze multiple AI model responses about a competitor. Extract what AI models collectively believe. Return ONLY valid JSON:
{
  "aiPerception": "2-3 sentence summary of what AI models believe about this competitor — their market position, reputation, and how they're perceived",
  "repeatedClaims": ["claims that appear in 2+ model responses — these have citation weight and drive AI recommendations"],
  "citedSources": ["specific sources, platforms, or signals AI models reference when discussing this competitor"],
  "perceivedStrengths": ["specific strengths AI attributes to this competitor"],
  "perceivedWeaknesses": ["weaknesses, gaps, or criticisms AI mentions"]
}`,
    messages: [{
      role: 'user',
      content: `Competitor: ${competitorName}${domain}\n\nAI MODEL RESPONSES:\n\n${allText.slice(0, 6000)}`,
    }],
  })

  const text = analysis.content[0].type === 'text' ? analysis.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)

  if (match) {
    const parsed = JSON.parse(match[0])
    return {
      aiPerception: parsed.aiPerception || '',
      repeatedClaims: Array.isArray(parsed.repeatedClaims) ? parsed.repeatedClaims : [],
      citedSources: Array.isArray(parsed.citedSources) ? parsed.citedSources : [],
      perceivedStrengths: Array.isArray(parsed.perceivedStrengths) ? parsed.perceivedStrengths : [],
      perceivedWeaknesses: Array.isArray(parsed.perceivedWeaknesses) ? parsed.perceivedWeaknesses : [],
      rawResponses: allRaw,
    }
  }

  return {
    aiPerception: '',
    repeatedClaims: [],
    citedSources: [],
    perceivedStrengths: [],
    perceivedWeaknesses: [],
    rawResponses: allRaw,
  }
}
