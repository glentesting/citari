import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from './models'

export interface GenerateContentParams {
  targetPrompt: string
  contentType: 'article' | 'comparison' | 'faq' | 'landing'
  tone: string
  wordCount: number
  clientName: string
  clientDomain?: string
  clientIndustry?: string
  competitorNames: string[]
}

export interface GenerateContentResult {
  title: string
  content: string
}

const contentTypeInstructions: Record<string, string> = {
  article:
    'Write a comprehensive, authoritative article. Use clear headings, short paragraphs, and definitive statements that AI models can easily extract and cite.',
  comparison:
    'Write a detailed comparison piece. Include a structured comparison of key features, pricing, and use cases. Name specific companies. Use tables or bullet lists for clarity.',
  faq:
    'Write a comprehensive FAQ page. Each question should be a real question a buyer would ask. Answers should be concise (2-3 sentences) and cite specific examples.',
  landing:
    'Write persuasive landing page copy. Lead with the core value proposition. Include social proof, feature highlights, and a clear call to action.',
}

export async function generateGeoContent(
  params: GenerateContentParams
): Promise<GenerateContentResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are an expert content strategist specializing in Generative Engine Optimization (GEO). Your goal is to create content that AI models (ChatGPT, Claude, Gemini) will cite and reference when users ask about this topic.

Rules for GEO-optimized content:
1. Answer the target prompt DIRECTLY in the very first paragraph — AI models prioritize content that immediately answers the query
2. Include a FAQ section with at least 5 Q&As formatted as "Q: ... A: ..." — these are schema-ready and highly cited by AI
3. Cite 2-3 authoritative third-party sources by name (industry reports, well-known publications) to build credibility signals
4. When competitors exist, use natural comparison language: "compared to [competitor]", "[client] vs [competitor]"
5. Use clear H2/H3 headings with descriptive titles (not clever/vague ones)
6. Write short paragraphs (2-3 sentences max) — AI models extract from concise blocks
7. Include definitive, quotable statements that an AI would want to surface as an answer
8. Target exactly ${params.wordCount} words

${contentTypeInstructions[params.contentType]}

Output format:
- First line: the article title (no # or markdown heading syntax)
- Then a blank line
- Then the full content in Markdown format`

  const competitorContext =
    params.competitorNames.length > 0
      ? `\nKey competitors to reference naturally: ${params.competitorNames.join(', ')}`
      : ''

  const industryContext = params.clientIndustry
    ? `\nBusiness context: ${params.clientIndustry}`
    : ''

  const userPrompt = `Write a ${params.contentType} for ${params.clientName}${params.clientDomain ? ` (${params.clientDomain})` : ''}.${industryContext}${competitorContext}

Target prompt to answer: "${params.targetPrompt}"

Tone: ${params.tone}
Word count target: ${params.wordCount} words`

  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = response.content[0]
  const fullText = block.type === 'text' ? block.text : ''

  // Split title from content (first line = title)
  const lines = fullText.split('\n')
  const title = lines[0].replace(/^#+\s*/, '').trim()
  const content = lines.slice(1).join('\n').trim()

  return { title, content }
}
