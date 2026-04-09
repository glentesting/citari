import { SupabaseClient } from '@supabase/supabase-js'

export interface ShareOfVoiceEntry {
  name: string
  mentions: number
  share: number
  isClient: boolean
}

export interface ShareOfVoiceResult {
  overall: ShareOfVoiceEntry[]
  perPlatform: Record<string, ShareOfVoiceEntry[]>
  clientShare: number
}

/**
 * Calculate share of voice: what % of all brand mentions (client + competitors)
 * belong to the client vs each competitor.
 */
export async function calculateShareOfVoice(
  supabase: SupabaseClient,
  clientId: string,
  clientName: string
): Promise<ShareOfVoiceResult> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: scans } = await supabase
    .from('scan_results')
    .select('model, mentioned, competitor_mentions')
    .eq('client_id', clientId)
    .gte('scanned_at', thirtyDaysAgo.toISOString())

  const results = scans || []

  // Count mentions per brand across all scans
  const mentionCounts = new Map<string, number>()
  mentionCounts.set(clientName, 0)

  for (const r of results) {
    if (r.mentioned) {
      mentionCounts.set(clientName, (mentionCounts.get(clientName) || 0) + 1)
    }
    if (r.competitor_mentions) {
      for (const comp of r.competitor_mentions) {
        mentionCounts.set(comp, (mentionCounts.get(comp) || 0) + 1)
      }
    }
  }

  const totalMentions = Array.from(mentionCounts.values()).reduce((a, b) => a + b, 0)

  function buildEntries(counts: Map<string, number>, total: number): ShareOfVoiceEntry[] {
    return Array.from(counts.entries())
      .map(([name, mentions]) => ({
        name,
        mentions,
        share: total > 0 ? Math.round((mentions / total) * 100) : 0,
        isClient: name === clientName,
      }))
      .sort((a, b) => b.share - a.share)
  }

  const overall = buildEntries(mentionCounts, totalMentions)

  // Per-platform breakdown
  const models = ['chatgpt', 'claude', 'gemini'] as const
  const perPlatform: Record<string, ShareOfVoiceEntry[]> = {}

  for (const model of models) {
    const modelResults = results.filter((r) => r.model === model)
    const modelCounts = new Map<string, number>()
    modelCounts.set(clientName, 0)

    for (const r of modelResults) {
      if (r.mentioned) {
        modelCounts.set(clientName, (modelCounts.get(clientName) || 0) + 1)
      }
      if (r.competitor_mentions) {
        for (const comp of r.competitor_mentions) {
          modelCounts.set(comp, (modelCounts.get(comp) || 0) + 1)
        }
      }
    }

    const modelTotal = Array.from(modelCounts.values()).reduce((a, b) => a + b, 0)
    perPlatform[model] = buildEntries(modelCounts, modelTotal)
  }

  const clientEntry = overall.find((e) => e.isClient)
  const clientShare = clientEntry?.share || 0

  return { overall, perPlatform, clientShare }
}
