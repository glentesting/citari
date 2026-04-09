import { SupabaseClient } from '@supabase/supabase-js'

export interface QualityScoreResult {
  score: number // 0-100
  tier: 'excellent' | 'good' | 'developing' | 'low'
  recommendation: string
  breakdown: {
    leadingCount: number
    supportingCount: number
    mentionedCount: number
    totalScans: number
  }
}

/**
 * Response Quality Score (RQS): weighted average of authority_score
 * across all scan results. Leading mentions count 3x, supporting 2x, basic 1x.
 */
export async function calculateQualityScore(
  supabase: SupabaseClient,
  clientId: string
): Promise<QualityScoreResult> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: scans } = await supabase
    .from('scan_results')
    .select('mention_quality, authority_score')
    .eq('client_id', clientId)
    .gte('scanned_at', thirtyDaysAgo.toISOString())

  const results = scans || []
  if (results.length === 0) {
    return {
      score: 0,
      tier: 'low',
      recommendation: 'No scan data yet. Run your first scan to calculate your quality score.',
      breakdown: { leadingCount: 0, supportingCount: 0, mentionedCount: 0, totalScans: 0 },
    }
  }

  let weightedSum = 0
  let weightTotal = 0
  let leadingCount = 0
  let supportingCount = 0
  let mentionedCount = 0

  for (const r of results) {
    const auth = r.authority_score || 0
    const quality = r.mention_quality

    if (quality === 'leading') {
      weightedSum += auth * 3
      weightTotal += 3
      leadingCount++
    } else if (quality === 'supporting') {
      weightedSum += auth * 2
      weightTotal += 2
      supportingCount++
    } else if (quality === 'mentioned') {
      weightedSum += auth * 1
      weightTotal += 1
      mentionedCount++
    }
    // not_mentioned gets 0 weight
  }

  const rawScore = weightTotal > 0 ? weightedSum / weightTotal : 0
  const score = Math.round(rawScore * 10) // Scale 1-10 to 0-100

  let tier: QualityScoreResult['tier']
  let recommendation: string

  if (score >= 80) {
    tier = 'excellent'
    recommendation = 'Maintain your strategy and expand to new prompt categories. You are the primary recommendation in most AI responses.'
  } else if (score >= 60) {
    tier = 'good'
    recommendation = 'Publish comparison content for evaluation prompts. Add more third-party citations and case studies to strengthen authority.'
  } else if (score >= 40) {
    tier = 'developing'
    recommendation = 'Add more third-party citations and case studies. Focus on FAQ schema and direct-answer content to improve authority signals.'
  } else {
    tier = 'low'
    recommendation = 'Focus on FAQ schema and direct-answer content. Get listed on review platforms and publish structured comparison content.'
  }

  return {
    score,
    tier,
    recommendation,
    breakdown: { leadingCount, supportingCount, mentionedCount, totalScans: results.length },
  }
}
