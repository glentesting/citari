import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { searchKeyword } from '@/lib/keywords/serper'

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

  const { client_id, action, keyword, category } = await request.json()
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Add keyword manually
  if (action === 'add' && keyword) {
    const { data: client } = await admin.from('clients').select('domain').eq('id', client_id).single()
    const { data: comps } = await admin.from('competitors').select('domain').eq('client_id', client_id)
    const compDomains = (comps || []).map((c) => c.domain).filter(Boolean) as string[]

    const result = await searchKeyword(keyword, client?.domain || '', compDomains)

    const { data: saved, error } = await admin.from('keywords').insert({
      client_id,
      keyword,
      category: category || 'category',
      your_rank: result.position,
      top_competitor_name: result.topCompetitorName,
      top_competitor_rank: result.topCompetitorRank,
      monthly_volume: result.monthlyVolume,
      ai_visible: 'no',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(saved)
  }

  // Refresh all keywords
  if (action === 'refresh') {
    const { data: keywords } = await admin.from('keywords').select('id, keyword').eq('client_id', client_id)
    const { data: client } = await admin.from('clients').select('domain').eq('id', client_id).single()
    const { data: comps } = await admin.from('competitors').select('domain').eq('client_id', client_id)
    const compDomains = (comps || []).map((c) => c.domain).filter(Boolean) as string[]

    let updated = 0
    for (const kw of keywords || []) {
      const result = await searchKeyword(kw.keyword, client?.domain || '', compDomains)
      await admin.from('keywords').update({
        your_rank: result.position,
        top_competitor_name: result.topCompetitorName,
        top_competitor_rank: result.topCompetitorRank,
        monthly_volume: result.monthlyVolume,
        last_updated: new Date().toISOString(),
      }).eq('id', kw.id)
      updated++
    }

    return NextResponse.json({ updated })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
