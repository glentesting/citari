import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { calculateCategoryBenchmarks } from '@/lib/analytics/benchmarks'

export const maxDuration = 120

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const benchmarks = await calculateCategoryBenchmarks(supabase)

  // Store benchmarks
  for (const b of benchmarks) {
    await supabase
      .from('category_benchmarks')
      .upsert({
        industry: b.industry,
        metric: 'monthly_summary',
        value: {
          avgVisibilityScore: b.avgVisibilityScore,
          avgAuthorityScore: b.avgAuthorityScore,
          avgGapCount: b.avgGapCount,
          topContentType: b.topContentType,
        },
        sample_size: b.sampleSize,
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'industry,metric' })
  }

  return NextResponse.json({ calculated: benchmarks.length })
}
