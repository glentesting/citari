import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { generateCompetitorIntelligence } from '@/lib/competitors/intelligence'

export const maxDuration = 120

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

  const { competitor_id } = await request.json()
  if (!competitor_id) return NextResponse.json({ error: 'competitor_id required' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Fetch competitor
  const { data: competitor } = await admin.from('competitors')
    .select('id, name, domain, client_id')
    .eq('id', competitor_id)
    .single()

  if (!competitor) return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })

  // Fetch client profile
  const { data: client } = await admin.from('clients')
    .select('name, domain, industry, location, specialization, description, target_clients, differentiators')
    .eq('id', competitor.client_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Fetch crawled content
  const { data: content } = await admin.from('competitor_content')
    .select('title, excerpt')
    .eq('competitor_id', competitor_id)
    .limit(10)

  // Fetch scan results where this competitor is mentioned
  const { data: scans } = await admin.from('scan_results')
    .select('response_excerpt, competitor_mentions')
    .eq('client_id', competitor.client_id)
    .order('scanned_at', { ascending: false })
    .limit(100)

  const scanContext = (scans || [])
    .filter((s: any) => s.competitor_mentions?.includes(competitor.name))
    .slice(0, 5)
    .map((s: any) => s.response_excerpt?.slice(0, 300))
    .filter(Boolean)
    .join('\n---\n')

  try {
    const intel = await generateCompetitorIntelligence(
      client,
      { name: competitor.name, domain: competitor.domain },
      content || [],
      scanContext || undefined
    )

    // Save to competitors table
    await admin.from('competitors').update({
      intel_brief: intel.intel_brief,
      why_winning: intel.why_winning,
      content_gaps: intel.content_gaps,
      visibility_score: intel.visibility_score,
    }).eq('id', competitor_id)

    return NextResponse.json(intel)
  } catch (e: any) {
    console.error('Competitive intelligence analysis failed:', e)
    return NextResponse.json({ error: 'Intelligence analysis failed — please try again' }, { status: 502 })
  }
}
