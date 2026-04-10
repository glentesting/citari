import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { buildClientContext } from '@/lib/utils'

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

  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 3000,
    system: `You are a senior competitive intelligence analyst. Your job is to explain exactly why a competitor is winning more customers than your client, and what to do about it. Be specific, direct, and ruthless. No fluff.

Return ONLY valid JSON:
{
  "why_winning": "string (3-4 sentences — the real reasons this competitor is getting more customers. Be specific. Reference their actual content and positioning)",
  "content_gaps": "string (bullet list of specific topics the competitor covers that the client does not. Each bullet should start with '- ' and be one actionable content opportunity)",
  "visibility_score": number 1-100 (estimated AI visibility strength based on their content depth, specificity, and authority signals),
  "intel_brief": "string (the full written brief — 4-6 paragraphs. Written like a consultant report. Covers: who they are, why they're winning, where they show up in AI responses, what the client needs to do to compete. Specific, not generic. Reference actual content topics and positioning differences)",
  "quick_wins": ["string (3-5 specific actions the client can take THIS WEEK to start competing. Each should be a concrete task, not vague advice)"],
  "threat_level": "low | medium | high | critical (based on how directly they compete and how strong their presence is)"
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
  })

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
