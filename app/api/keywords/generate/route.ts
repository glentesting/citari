import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { buildClientContext } from '@/lib/utils'

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timed out after ${ms}ms`)), ms))])

export const maxDuration = 60

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

    const { client_id } = await request.json()
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: client } = await admin
      .from('clients')
      .select('name, domain, industry, location, specialization, description, target_clients, differentiators')
      .eq('id', client_id)
      .single()

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const clientContext = buildClientContext(client)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const res = await withTimeout(anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1024,
      system: `Generate 8 buyer-intent keywords for this business.${client.location ? ` Include location-specific keywords for: ${client.location}.` : ''} Do NOT generate directory names or award sites. Return ONLY valid JSON: {"keywords":["keyword1","keyword2",...]}`,
      messages: [{ role: 'user', content: `Business: ${clientContext}\nDomain: ${client.domain || 'N/A'}` }],
    }), 25000)

    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Failed to parse response' }, { status: 500 })

    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed.keywords)) return NextResponse.json({ error: 'No keywords generated' }, { status: 500 })

    const keywords = parsed.keywords.slice(0, 8)

    // Check for duplicates
    const { data: existing } = await admin.from('keywords').select('keyword').eq('client_id', client_id)
    const existingSet = new Set((existing || []).map((k) => k.keyword.toLowerCase()))
    const newKeywords = keywords.filter((kw: string) => !existingSet.has(kw.toLowerCase()))

    if (newKeywords.length > 0) {
      const rows = newKeywords.map((kw: string) => ({
        client_id, keyword: kw, category: 'category' as const,
        monthly_volume: null, your_rank: null,
        top_competitor_name: null, top_competitor_rank: null,
        ai_visible: 'no' as const,
      }))
      await admin.from('keywords').insert(rows)
    }

    return NextResponse.json({ added: newKeywords.length, keywords: newKeywords })
  } catch (e: any) {
    console.error('Keyword generation failed:', e)
    return NextResponse.json({ error: e.message || 'Generation failed' }, { status: 500 })
  }
}
