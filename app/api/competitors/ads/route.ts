import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { fetchGoogleAds } from '@/lib/ads/google'
import { fetchMetaAds } from '@/lib/ads/meta'

export async function POST(request: Request) {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as any)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { competitor_id } = await request.json()
  if (!competitor_id) {
    return NextResponse.json({ error: 'competitor_id is required' }, { status: 400 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: competitor } = await adminSupabase
    .from('competitors')
    .select('id, name, domain')
    .eq('id', competitor_id)
    .single()

  if (!competitor) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
  }

  const allAds: any[] = []

  // Fetch Google ads
  if (competitor.domain) {
    const googleAds = await fetchGoogleAds(competitor.domain)
    for (const ad of googleAds) {
      allAds.push({
        competitor_id: competitor.id,
        platform: 'google',
        ad_text: ad.ad_text,
        ad_url: ad.ad_url,
        first_seen: ad.first_seen,
        last_seen: ad.last_seen,
        is_active: true,
      })
    }
  }

  // Fetch Meta ads
  const metaAds = await fetchMetaAds(competitor.name)
  for (const ad of metaAds) {
    allAds.push({
      competitor_id: competitor.id,
      platform: 'meta',
      ad_text: ad.ad_text,
      ad_url: ad.ad_url,
      first_seen: ad.first_seen,
      last_seen: ad.last_seen,
      is_active: true,
    })
  }

  // Delete old ads for this competitor
  await adminSupabase
    .from('competitor_ads')
    .delete()
    .eq('competitor_id', competitor.id)

  // Insert new ads
  if (allAds.length > 0) {
    const { error: insertError } = await adminSupabase
      .from('competitor_ads')
      .insert(allAds)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    google_ads: allAds.filter((a) => a.platform === 'google').length,
    meta_ads: allAds.filter((a) => a.platform === 'meta').length,
    total: allAds.length,
  })
}
