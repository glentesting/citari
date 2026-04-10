import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { fetchYelpReviews, fetchYelpBusinessId } from '@/lib/reviews/fetch'

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

  const { data: client } = await admin.from('clients').select('name, domain, industry').eq('id', client_id).single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const allReviews: any[] = []

  // Fetch Yelp reviews
  try {
    const yelpId = await fetchYelpBusinessId(client.name, 'US')
    if (yelpId) {
      const yelpReviews = await fetchYelpReviews(yelpId)
      for (const r of yelpReviews) {
        allReviews.push({
          client_id,
          platform: 'yelp',
          rating: r.rating,
          review_text: r.review_text,
          author: r.author,
          reviewed_at: r.reviewed_at,
          sentiment: r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative',
        })
      }
    }
  } catch (e: any) { console.error('Review sync failed:', e) }

  // Delete old non-google reviews and insert fresh
  if (allReviews.length > 0) {
    const platforms = [...new Set(allReviews.map((r) => r.platform))]
    for (const platform of platforms) {
      await admin.from('reviews').delete().eq('client_id', client_id).eq('platform', platform)
    }
    await admin.from('reviews').insert(allReviews)
  }

  return NextResponse.json({ synced: allReviews.length })
}
