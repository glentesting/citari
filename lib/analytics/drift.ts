import { SupabaseClient } from '@supabase/supabase-js'

export interface DriftEvent {
  model: 'chatgpt' | 'claude' | 'gemini'
  description: string
  affectedPromptCount: number
  detectedAt: string
  isModelUpdate: boolean
  recommendation: string
}

/**
 * Detect AI model drift by comparing last 7-day scan patterns
 * vs previous 7 days per model.
 */
export async function detectModelDrift(
  supabase: SupabaseClient,
  clientId: string
): Promise<DriftEvent[]> {
  const now = new Date()
  const oneWeekAgo = new Date(now)
  oneWeekAgo.setDate(now.getDate() - 7)
  const twoWeeksAgo = new Date(now)
  twoWeeksAgo.setDate(now.getDate() - 14)

  const { data: thisWeek } = await supabase
    .from('scan_results')
    .select('model, prompt_id, mentioned, mention_quality')
    .eq('client_id', clientId)
    .gte('scanned_at', oneWeekAgo.toISOString())

  const { data: lastWeek } = await supabase
    .from('scan_results')
    .select('model, prompt_id, mentioned, mention_quality')
    .eq('client_id', clientId)
    .gte('scanned_at', twoWeeksAgo.toISOString())
    .lt('scanned_at', oneWeekAgo.toISOString())

  const current = thisWeek || []
  const previous = lastWeek || []

  if (current.length === 0 || previous.length === 0) return []

  const events: DriftEvent[] = []
  const models = ['chatgpt', 'claude', 'gemini'] as const

  for (const model of models) {
    const modelCurrent = current.filter((r) => r.model === model)
    const modelPrevious = previous.filter((r) => r.model === model)

    if (modelCurrent.length === 0 || modelPrevious.length === 0) continue

    // Compare mention rates per prompt
    const promptIds = [...new Set([...modelCurrent.map((r) => r.prompt_id), ...modelPrevious.map((r) => r.prompt_id)])]

    let changedPrompts = 0
    for (const pid of promptIds) {
      const curMentioned = modelCurrent.find((r) => r.prompt_id === pid)?.mentioned
      const prevMentioned = modelPrevious.find((r) => r.prompt_id === pid)?.mentioned

      if (curMentioned !== undefined && prevMentioned !== undefined && curMentioned !== prevMentioned) {
        changedPrompts++
      }
    }

    // If 3+ prompts changed simultaneously, flag as potential model drift
    if (changedPrompts >= 3) {
      const currentRate = Math.round((modelCurrent.filter((r) => r.mentioned).length / modelCurrent.length) * 100)
      const previousRate = Math.round((modelPrevious.filter((r) => r.mentioned).length / modelPrevious.length) * 100)
      const delta = currentRate - previousRate

      events.push({
        model,
        description: `${model === 'chatgpt' ? 'ChatGPT' : model === 'claude' ? 'Claude' : 'Gemini'}'s response patterns changed significantly — ${changedPrompts} prompts affected, ${delta >= 0 ? '+' : ''}${delta}% overall change.`,
        affectedPromptCount: changedPrompts,
        detectedAt: now.toISOString(),
        isModelUpdate: changedPrompts >= Math.floor(promptIds.length * 0.5), // If >50% of prompts changed, likely model update
        recommendation: changedPrompts >= Math.floor(promptIds.length * 0.5)
          ? 'This appears to be a model update — wait 2 weeks to see if patterns stabilize, then reassess.'
          : 'This may be competitor-driven. Check competitor activity and consider counter-content.',
      })
    }
  }

  return events
}
