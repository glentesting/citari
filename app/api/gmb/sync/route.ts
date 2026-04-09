import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getGMBLocations, getGMBReviews } from '@/lib/gmb/client'

export const maxDuration = 60

export async function POST(request: Request) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { client_id } = await request.json()
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Find GMB connection
  const { data: connection } = await admin
    .from('cms_connections')
    .select('access_token')
    .eq('platform', 'gmb')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'No GMB connection found. Connect Google My Business in Settings.' }, { status: 404 })
  }

  const locations = await getGMBLocations(connection.access_token)
  if (locations.length === 0) {
    return NextResponse.json({ error: 'No GMB locations found' }, { status: 404 })
  }

  const location = locations[0]

  // Fetch reviews
  const reviews = await getGMBReviews(connection.access_token, location.name)
  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 100) / 100
    : 0

  // Upsert GMB data
  const { data: existing } = await admin
    .from('gmb_data')
    .select('id')
    .eq('client_id', client_id)
    .single()

  const gmbRow = {
    client_id,
    location_id: location.locationId,
    business_name: location.businessName,
    rating: avgRating,
    review_count: reviews.length,
    photo_count: 0, // Would need additional API call
    post_count: 0,
    is_verified: location.isVerified,
    categories: location.categories,
    last_synced: new Date().toISOString(),
  }

  if (existing) {
    await admin.from('gmb_data').update(gmbRow).eq('id', existing.id)
  } else {
    await admin.from('gmb_data').insert(gmbRow)
  }

  // Store reviews
  if (reviews.length > 0) {
    const reviewRows = reviews.slice(0, 50).map((r) => ({
      client_id,
      platform: 'google' as const,
      rating: r.rating,
      review_text: r.comment,
      author: r.author,
      reviewed_at: r.createTime ? r.createTime.split('T')[0] : null,
      sentiment: r.rating >= 4 ? 'positive' as const : r.rating === 3 ? 'neutral' as const : 'negative' as const,
    }))

    // Delete old google reviews for this client and insert fresh
    await admin.from('reviews').delete().eq('client_id', client_id).eq('platform', 'google')
    await admin.from('reviews').insert(reviewRows)
  }

  return NextResponse.json({
    location: location.businessName,
    reviews: reviews.length,
    rating: avgRating,
    verified: location.isVerified,
  })
}
