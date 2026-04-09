import { SupabaseClient } from '@supabase/supabase-js'

export interface PredictiveThreat {
  threat: string
  competitor: string
  evidence: string
  urgency: 'high' | 'medium' | 'low'
  recommendedAction: string
  estimatedTimeToImpact: string
}

/**
 * Detect predictive threats by analyzing competitor content velocity
 * and cross-referencing with tracked prompts.
 */
export async function detectPredictiveThreats(
  supabase: SupabaseClient,
  clientId: string
): Promise<PredictiveThreat[]> {
  const threats: PredictiveThreat[] = []

  // Fetch competitors
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name')
    .eq('client_id', clientId)

  if (!competitors || competitors.length === 0) return []

  // Fetch recent competitor content
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  for (const comp of competitors) {
    const { data: recentContent } = await supabase
      .from('competitor_content')
      .select('title, url')
      .eq('competitor_id', comp.id)
      .gte('crawled_at', oneWeekAgo.toISOString())

    if (!recentContent || recentContent.length < 2) continue

    // Fetch prompts to cross-reference
    const { data: prompts } = await supabase
      .from('prompts')
      .select('text')
      .eq('client_id', clientId)
      .eq('is_active', true)

    if (!prompts || prompts.length === 0) continue

    // Check if new content topics match tracked prompts
    let matchCount = 0
    const matchedTopics: string[] = []

    for (const content of recentContent) {
      const titleLower = (content.title || '').toLowerCase()
      for (const prompt of prompts) {
        const promptWords = prompt.text.toLowerCase().split(' ').filter((w: string) => w.length > 4)
        const matches = promptWords.filter((w: string) => titleLower.includes(w)).length
        if (matches >= 2) {
          matchCount++
          matchedTopics.push(content.title || '')
          break
        }
      }
    }

    if (matchCount >= 2) {
      threats.push({
        threat: `${comp.name} published ${recentContent.length} content pieces this week targeting prompts you track`,
        competitor: comp.name,
        evidence: `New content: ${matchedTopics.slice(0, 3).join(', ')}`,
        urgency: matchCount >= 4 ? 'high' : matchCount >= 2 ? 'medium' : 'low',
        recommendedAction: `Create counter-content targeting the same ${matchCount} prompts. Citari can generate these automatically.`,
        estimatedTimeToImpact: '2-4 weeks',
      })
    }
  }

  return threats.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.urgency] - order[b.urgency]
  })
}
