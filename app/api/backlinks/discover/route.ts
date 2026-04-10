import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { discoverBacklinkOpportunities } from '@/lib/backlinks/opportunities'

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

  const { data: client } = await admin.from('clients').select('name, domain, industry, specialization').eq('id', client_id).single()
  if (!client || !client.domain) return NextResponse.json({ error: 'Client not found or missing domain' }, { status: 404 })

  const { data: competitors } = await admin.from('competitors').select('name, domain').eq('client_id', client_id)
  const compDomains = (competitors || []).map((c) => c.domain).filter(Boolean) as string[]
  const compNames = (competitors || []).map((c) => c.name).filter(Boolean)

  if (compDomains.length === 0 && compNames.length === 0) {
    return NextResponse.json({ error: 'Add competitors first' }, { status: 400 })
  }

  // Use competitor domains if available, otherwise search by competitor names
  const searchDomains = compDomains.length > 0
    ? compDomains
    : compNames.slice(0, 3).map((name) => name.toLowerCase().replace(/\s+/g, ''))

  const opportunities = await discoverBacklinkOpportunities(client.domain, searchDomains, client.specialization || client.industry)

  // Delete old and insert fresh
  await admin.from('backlink_opportunities').delete().eq('client_id', client_id)

  if (opportunities.length > 0) {
    const rows = opportunities.map((o) => ({
      client_id,
      source_domain: o.source_domain,
      source_url: o.source_url,
      relevance_score: o.relevance_score,
      opportunity_type: o.opportunity_type,
      status: 'identified',
    }))
    await admin.from('backlink_opportunities').insert(rows)
  }

  return NextResponse.json({ found: opportunities.length })
}
