import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { scanPrompt } from '@/lib/ai/scan'

export const maxDuration = 60

export async function POST(request: Request) {
  const cookieStore = cookies()

  // Auth check — use the user's session
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

  const body = await request.json()
  const { client_id, prompt_ids } = body as {
    client_id: string
    prompt_ids?: string[] // optional — if omitted, scan all active prompts
  }

  if (!client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  // Use service role for DB writes (bypasses RLS for insert)
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch client info
  const { data: client } = await adminSupabase
    .from('clients')
    .select('name, domain')
    .eq('id', client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Fetch competitors for this client
  const { data: competitors } = await adminSupabase
    .from('competitors')
    .select('name')
    .eq('client_id', client_id)

  const competitorNames = (competitors || []).map((c) => c.name)

  // Fetch prompts to scan
  let promptQuery = adminSupabase
    .from('prompts')
    .select('id, text')
    .eq('client_id', client_id)
    .eq('is_active', true)

  if (prompt_ids && prompt_ids.length > 0) {
    promptQuery = promptQuery.in('id', prompt_ids)
  }

  const { data: prompts } = await promptQuery

  if (!prompts || prompts.length === 0) {
    return NextResponse.json({ error: 'No active prompts to scan' }, { status: 400 })
  }

  // Scan each prompt across all 3 models
  const allResults: any[] = []

  for (const prompt of prompts) {
    const results = await scanPrompt(prompt.text, client.name, competitorNames)

    for (const result of results) {
      allResults.push({
        prompt_id: prompt.id,
        client_id,
        model: result.model,
        mentioned: result.mentioned,
        mention_position: result.mention_position,
        mention_quality: result.mention_quality,
        authority_score: result.authority_score,
        recommendation_strength: result.recommendation_strength,
        why_competitor_wins: result.why_competitor_wins,
        citation_sources: result.citation_sources,
        citation_source_types: result.citation_source_types,
        sentiment: result.sentiment,
        response_excerpt: result.response_excerpt,
        competitor_mentions: result.competitor_mentions,
      })
    }
  }

  // Insert all results
  const { error: insertError } = await adminSupabase
    .from('scan_results')
    .insert(allResults)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    scanned: prompts.length,
    results: allResults.length,
    summary: {
      total_mentions: allResults.filter((r) => r.mentioned).length,
      total_results: allResults.length,
    },
  })
}
