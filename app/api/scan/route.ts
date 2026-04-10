import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { scanPrompt } from '@/lib/ai/scan'
import { buildClientContext } from '@/lib/utils'

export const maxDuration = 300

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
    prompt_ids?: string[]
  }

  if (!client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  // Use service role for DB writes (bypasses RLS for insert)
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch client info with full context
  const { data: client } = await adminSupabase
    .from('clients')
    .select('name, domain, industry, location, specialization, description, target_clients, differentiators')
    .eq('id', client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const clientContext = buildClientContext(client)

  // Fetch competitors for this client
  const { data: competitors } = await adminSupabase
    .from('competitors')
    .select('name')
    .eq('client_id', client_id)

  const competitorNames = (competitors || []).map((c) => c.name)

  // Fetch prompts to scan
  let promptQuery = adminSupabase.from('prompts')
    .select('id, text').eq('client_id', client_id).eq('is_active', true)

  if (prompt_ids && prompt_ids.length > 0) {
    promptQuery = promptQuery.in('id', prompt_ids)
  }

  const { data: prompts } = await promptQuery

  if (!prompts || prompts.length === 0) {
    return NextResponse.json({ error: 'No active prompts to scan' }, { status: 400 })
  }

  // Scan prompts in parallel batches of 3
  const allResults: any[] = []
  const BATCH = 3

  for (let i = 0; i < prompts.length; i += BATCH) {
    const batch = prompts.slice(i, i + BATCH)
    const batchResults = await Promise.allSettled(
      batch.map((prompt) => scanPrompt(prompt.text, client.name, competitorNames, clientContext))
    )

    for (let j = 0; j < batchResults.length; j++) {
      const settled = batchResults[j]
      const prompt = batch[j]
      if (settled.status === 'fulfilled') {
        for (const result of settled.value) {
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
      } else {
        console.error(`Scan failed for prompt "${prompt.text.slice(0, 50)}":`, settled.reason)
      }
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
