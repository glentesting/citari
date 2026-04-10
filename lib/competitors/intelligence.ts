import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { buildClientContext } from '@/lib/utils'

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ])

export interface CompetitorIntelligence {
  why_winning: string
  content_gaps: string
  visibility_score: number
  intel_brief: string
  quick_wins: string[]
  threat_level: 'low' | 'medium' | 'high' | 'critical'
}

interface ClientProfile {
  name: string
  domain?: string | null
  industry?: string | null
  location?: string | null
  specialization?: string | null
  description?: string | null
  target_clients?: string | null
  differentiators?: string | null
}

interface CompetitorProfile {
  name: string
  domain?: string | null
}

interface CompetitorContent {
  title: string
  excerpt: string
}

/**
 * Generate a complete competitive intelligence brief for one competitor.
 * Returns structured intel data ready to be saved to the competitors table.
 */
export async function generateCompetitorIntelligence(
  client: ClientProfile,
  competitor: CompetitorProfile,
  competitorContent: CompetitorContent[],
  scanContext?: string
): Promise<CompetitorIntelligence> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const clientContext = buildClientContext(client)

  const contentSummary = competitorContent
    .map((c) => `${c.title}: ${c.excerpt.slice(0, 300)}`)
    .join('\n\n')

  const response = await withTimeout(anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 3000,
    system: `You are a senior competitive intelligence analyst. Analyze the competitor and provide strategic intelligence. Use crawled website content if provided. If no content was crawled, use your knowledge of this competitor — they are a real company and you likely know about them. NEVER refuse to analyze. NEVER say you cannot complete the analysis. Always provide your best assessment.

Return ONLY valid JSON:
{
  "why_winning": "3-4 sentences on why this competitor attracts customers. Be specific about their positioning, reputation, and market presence.",
  "content_gaps": "Bullet list starting with '- '. Each bullet is a specific topic or content type the client should create to compete. Give 5-7 actionable gaps.",
  "visibility_score": 1-100 integer estimating their AI/search visibility strength,
  "intel_brief": "A structured brief using these exact section headers on their own lines:\\n\\n## Overview\\n(Who they are, what they do)\\n\\n## Why They Win\\n(Their competitive advantages)\\n\\n## Where They Show Up\\n(Search, AI, directories, rankings)\\n\\n## What You Should Do\\n(3-5 specific recommendations for the client)",
  "quick_wins": ["3-5 specific actions the client can take THIS WEEK. Concrete tasks, not vague advice."],
  "threat_level": "low | medium | high | critical"
}`,
    messages: [{
      role: 'user',
      content: [
        `CLIENT PROFILE:`,
        clientContext,
        `Domain: ${client.domain || 'N/A'}`,
        ``,
        `COMPETITOR: ${competitor.name}`,
        `Domain: ${competitor.domain || 'N/A'}`,
        ``,
        `COMPETITOR WEBSITE CONTENT:`,
        contentSummary.slice(0, 5000) || 'No content crawled — analyze based on what you know about this competitor.',
        scanContext ? `\nAI SCAN RESULTS (where this competitor appears in AI model responses):\n${scanContext}` : '',
      ].join('\n'),
    }],
  }), 30000)

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error('Failed to parse intelligence response')
  }

  const intel = JSON.parse(match[0])

  return {
    why_winning: intel.why_winning || '',
    content_gaps: intel.content_gaps || '',
    visibility_score: typeof intel.visibility_score === 'number' ? intel.visibility_score : 50,
    intel_brief: intel.intel_brief || '',
    quick_wins: Array.isArray(intel.quick_wins) ? intel.quick_wins : [],
    threat_level: ['low', 'medium', 'high', 'critical'].includes(intel.threat_level) ? intel.threat_level : 'medium',
  }
}
