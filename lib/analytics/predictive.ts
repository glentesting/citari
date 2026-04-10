import { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ])

export interface PredictiveThreat {
  threat: string
  competitor: string
  evidence: string
  urgency: 'high' | 'medium' | 'low'
  recommendedAction: string
  estimatedTimeToImpact: string
}

/**
 * Detect predictive threats using Claude for semantic analysis
 * instead of keyword matching. Analyzes competitor content against
 * tracked prompts to find real threats, not just word overlap.
 */
export async function detectPredictiveThreats(
  supabase: SupabaseClient,
  clientId: string
): Promise<PredictiveThreat[]> {
  // Fetch competitors with recent content
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name')
    .eq('client_id', clientId)

  if (!competitors || competitors.length === 0) return []

  // Fetch tracked prompts
  const { data: prompts } = await supabase
    .from('prompts')
    .select('text')
    .eq('client_id', clientId)
    .eq('is_active', true)

  if (!prompts || prompts.length === 0) return []
  const promptTexts = prompts.map((p) => p.text)

  // Fetch recent competitor content (last 14 days)
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const allContent: { competitor: string; titles: string[] }[] = []

  for (const comp of competitors) {
    const { data: content } = await supabase
      .from('competitor_content')
      .select('title')
      .eq('competitor_id', comp.id)
      .gte('crawled_at', twoWeeksAgo.toISOString())

    if (content && content.length > 0) {
      allContent.push({
        competitor: comp.name,
        titles: content.map((c) => c.title),
      })
    }
  }

  if (allContent.length === 0) return []

  // Use Claude for semantic threat detection
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const contentSummary = allContent
      .map((c) => `${c.competitor}:\n${c.titles.map((t) => `  - ${t}`).join('\n')}`)
      .join('\n\n')

    const res = await withTimeout(anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 1024,
      system: `You are a competitive threat analyst. Analyze new competitor content against tracked prompts to detect semantic threats. A threat exists when competitor content directly addresses topics that the client's tracked prompts cover — even if the exact words don't match.

Return ONLY valid JSON: {"threats":[{"threat":"one sentence description","competitor":"name","evidence":"which content pieces and which prompts they threaten","urgency":"high|medium|low","recommendedAction":"specific counter-action","estimatedTimeToImpact":"e.g. 2-4 weeks"}]}

Only include real threats where competitor content could shift AI model recommendations. Max 5 threats, sorted by urgency.`,
      messages: [{
        role: 'user',
        content: `TRACKED PROMPTS:\n${promptTexts.map((p) => `- "${p}"`).join('\n')}\n\nRECENT COMPETITOR CONTENT:\n${contentSummary}`,
      }],
    }), 15000)

    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return (parsed.threats || []).slice(0, 5)
    }
  } catch (e) {
    console.error('Predictive threat detection failed:', e)
  }

  return []
}
