import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export async function POST(request: Request) {
  const { slug, password } = await request.json()

  if (!slug || !password) {
    return NextResponse.json({ error: 'slug and password are required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: portal } = await supabase
    .from('client_portal_access')
    .select('id, client_id, portal_password_hash, brand_name, brand_logo_url, accent_color, is_active')
    .eq('portal_slug', slug)
    .single()

  if (!portal || !portal.is_active) {
    return NextResponse.json({ error: 'Portal not found' }, { status: 404 })
  }

  const passwordHash = hashPassword(password)
  if (passwordHash !== portal.portal_password_hash) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  // Fetch client info
  const { data: client } = await supabase
    .from('clients')
    .select('name, industry')
    .eq('id', portal.client_id)
    .single()

  // Fetch scan results (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: scans } = await supabase
    .from('scan_results')
    .select('model, mentioned, competitor_mentions')
    .eq('client_id', portal.client_id)
    .gte('scanned_at', thirtyDaysAgo.toISOString())

  const results = scans || []
  const totalMentions = results.filter((r) => r.mentioned).length
  const visibilityScore = results.length > 0
    ? Math.round((totalMentions / results.length) * 100)
    : 0

  const models = ['chatgpt', 'claude', 'gemini'] as const
  const platformRates = models.map((model) => {
    const modelResults = results.filter((r) => r.model === model)
    const mentions = modelResults.filter((r) => r.mentioned).length
    return {
      name: model === 'chatgpt' ? 'ChatGPT' : model === 'claude' ? 'Claude' : 'Gemini',
      mentionRate: modelResults.length > 0 ? Math.round((mentions / modelResults.length) * 100) : 0,
      color: model === 'chatgpt' ? '#10A37F' : model === 'claude' ? '#D97757' : '#4285F4',
    }
  })

  // Competitor gaps
  const gapSet = new Set<string>()
  for (const r of results) {
    if (!r.mentioned && r.competitor_mentions && r.competitor_mentions.length > 0) {
      gapSet.add(r.competitor_mentions.join(', '))
    }
  }

  return NextResponse.json({
    client_name: client?.name || 'Client',
    industry: client?.industry,
    brand_name: portal.brand_name,
    brand_logo_url: portal.brand_logo_url,
    accent_color: portal.accent_color,
    visibilityScore,
    platformRates,
    gapCount: gapSet.size,
    totalScans: results.length,
  })
}
