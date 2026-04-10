import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { fetchYelpBusinessId, fetchYelpReviews } from '@/lib/reviews/fetch'
import { fetchWithTimeout } from '@/lib/utils'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'

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

  const { data: client } = await admin.from('clients').select('name, domain, industry, location, specialization, description, target_clients, differentiators').eq('id', client_id).single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const allReviews: any[] = []

  // Method 1: Yelp API (if key exists)
  try {
    const yelpId = await fetchYelpBusinessId(client.name, client.location || 'US')
    if (yelpId) {
      const yelpReviews = await fetchYelpReviews(yelpId)
      for (const r of yelpReviews) {
        allReviews.push({
          client_id, platform: 'yelp', rating: r.rating,
          review_text: r.review_text, author: r.author, reviewed_at: r.reviewed_at,
          sentiment: r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative',
        })
      }
    }
  } catch (e: any) { console.error('Yelp sync failed:', e) }

  // Method 2: Serper search for reviews (always works, no special API key)
  const serperKey = process.env.SERPER_API_KEY
  if (serperKey) {
    const reviewQueries = [
      `"${client.name}" reviews`,
      `site:google.com/maps "${client.name}" reviews`,
    ]

    for (const q of reviewQueries) {
      try {
        const res = await fetchWithTimeout('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q, gl: 'us', hl: 'en', num: 5 }),
          timeoutMs: 10000,
        })
        if (!res.ok) continue
        const data = await res.json()

        // Extract review snippets from search results
        for (const result of (data.organic || []).slice(0, 3)) {
          const snippet = result.snippet || ''
          const title = result.title || ''
          const link = result.link || ''

          // Detect platform from URL
          let platform = 'web'
          if (link.includes('google.com/maps') || link.includes('goo.gl')) platform = 'google'
          else if (link.includes('yelp.com')) platform = 'yelp'
          else if (link.includes('avvo.com')) platform = 'avvo'
          else if (link.includes('lawyers.com') || link.includes('martindale.com')) platform = 'martindale'
          else if (link.includes('bbb.org')) platform = 'bbb'

          // Look for rating patterns in snippet
          const ratingMatch = snippet.match(/(\d(?:\.\d)?)\s*(?:out of\s*5|\/\s*5|stars?)/i)
          const rating = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : null

          // Look for review count
          const countMatch = snippet.match(/(\d+)\s*reviews?/i)

          if (rating && platform !== 'web') {
            allReviews.push({
              client_id, platform, rating,
              review_text: snippet.slice(0, 500),
              author: `${platform} (via search)`,
              reviewed_at: null,
              sentiment: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative',
            })
          }
        }
      } catch (e: any) { console.error('Serper review search failed:', e) }
    }

    // Method 3: Use Claude to extract review intelligence from search results
    try {
      const searchRes = await fetchWithTimeout('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: `"${client.name}" reviews ratings`, gl: 'us', hl: 'en', num: 10 }),
        timeoutMs: 10000,
      })

      if (searchRes.ok) {
        const searchData = await searchRes.json()
        const snippets = (searchData.organic || [])
          .map((r: any) => `${r.title}: ${r.snippet} (${r.link})`)
          .join('\n')

        if (snippets.length > 50) {
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
          const aiRes = await anthropic.messages.create({
            model: MODELS.haiku,
            max_tokens: 512,
            system: `Extract review data from search results. Return ONLY valid JSON: {"reviews":[{"platform":"google|yelp|avvo|bbb|martindale","rating":4,"summary":"one sentence summary","source_url":"url"}]}. Only include reviews where you can determine a rating. Max 10 reviews.`,
            messages: [{ role: 'user', content: `Business: ${client.name}\n\nSearch results:\n${snippets.slice(0, 3000)}` }],
          })

          const aiText = aiRes.content[0].type === 'text' ? aiRes.content[0].text : ''
          const match = aiText.match(/\{[\s\S]*\}/)
          if (match) {
            const parsed = JSON.parse(match[0])
            for (const r of (parsed.reviews || [])) {
              // Avoid duplicates from same platform
              if (!allReviews.some((existing) => existing.platform === r.platform)) {
                allReviews.push({
                  client_id, platform: r.platform || 'web', rating: r.rating || 4,
                  review_text: r.summary || '', author: `${r.platform} listing`,
                  reviewed_at: null,
                  sentiment: (r.rating || 4) >= 4 ? 'positive' : (r.rating || 4) === 3 ? 'neutral' : 'negative',
                })
              }
            }
          }
        }
      }
    } catch (e: any) { console.error('AI review extraction failed:', e) }
  }

  // Save reviews
  if (allReviews.length > 0) {
    // Clear old reviews for this client
    await admin.from('reviews').delete().eq('client_id', client_id)
    await admin.from('reviews').insert(allReviews)
  }

  return NextResponse.json({ synced: allReviews.length })
}
