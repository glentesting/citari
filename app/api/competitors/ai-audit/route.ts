import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { runCompetitorAIAudit } from '@/lib/competitors/ai-audit'

export const maxDuration = 120

export async function POST(request: Request) {
  try {
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

    const { data: competitor } = await admin.from('competitors')
      .select('id, name, domain, client_id')
      .eq('id', competitor_id)
      .single()

    if (!competitor) return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })

    const { data: client } = await admin.from('clients')
      .select('industry')
      .eq('id', competitor.client_id)
      .single()

    const audit = await runCompetitorAIAudit(
      competitor.name,
      competitor.domain,
      client?.industry || null
    )

    // Store audit results in the competitor's intel fields
    // Merge AI perception into intel_brief, merge claims into why_winning
    const updateData: Record<string, any> = {}

    if (audit.aiPerception) {
      const { data: current } = await admin.from('competitors')
        .select('intel_brief').eq('id', competitor_id).single()

      const auditSection = [
        '## What AI Models Believe',
        audit.aiPerception,
        '',
        ...(audit.repeatedClaims.length > 0 ? ['**Claims AI repeats (citation weight):**', ...audit.repeatedClaims.map((c) => `- ${c}`), ''] : []),
        ...(audit.perceivedStrengths.length > 0 ? ['**Strengths AI attributes:**', ...audit.perceivedStrengths.map((s) => `- ${s}`), ''] : []),
        ...(audit.perceivedWeaknesses.length > 0 ? ['**Weaknesses AI mentions:**', ...audit.perceivedWeaknesses.map((w) => `- ${w}`), ''] : []),
        ...(audit.citedSources.length > 0 ? [`**Sources AI draws on:** ${audit.citedSources.join(', ')}`] : []),
      ].filter(Boolean).join('\n')

      // Strip any existing "What AI Models Believe" section before appending
      let baseBrief = (current?.intel_brief || '')
        .replace(/\n*## What AI Models Believe[\s\S]*$/, '')
        .trimEnd()

      updateData.intel_brief = baseBrief + '\n\n' + auditSection
    }

    if (Object.keys(updateData).length > 0) {
      await admin.from('competitors').update(updateData).eq('id', competitor_id)
    }

    return NextResponse.json({
      aiPerception: audit.aiPerception,
      repeatedClaims: audit.repeatedClaims,
      citedSources: audit.citedSources,
      perceivedStrengths: audit.perceivedStrengths,
      perceivedWeaknesses: audit.perceivedWeaknesses,
      questionsAsked: audit.rawResponses.length,
    })
  } catch (e: any) {
    console.error('AI audit failed:', e)
    return NextResponse.json({ error: 'AI audit failed — please try again' }, { status: 502 })
  }
}
