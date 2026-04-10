import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
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

  const { competitor_id, client_id } = await request.json()
  if (!competitor_id || !client_id) return NextResponse.json({ error: 'competitor_id and client_id required' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: client } = await admin.from('clients').select('name, industry, location, specialization, description').eq('id', client_id).single()
  const { data: competitor } = await admin.from('competitors').select('name, domain').eq('id', competitor_id).single()
  if (!client || !competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Gather intelligence
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: scans } = await admin
    .from('scan_results')
    .select('mentioned, mention_quality, authority_score, competitor_mentions, why_competitor_wins')
    .eq('client_id', client_id)
    .gte('scanned_at', thirtyDaysAgo.toISOString())

  const results = scans || []
  const clientMentions = results.filter((r) => r.mentioned).length
  const clientRate = results.length > 0 ? Math.round((clientMentions / results.length) * 100) : 0

  const compMentions = results.filter((r) => r.competitor_mentions?.includes(competitor.name)).length
  const compRate = results.length > 0 ? Math.round((compMentions / results.length) * 100) : 0

  const promptsCompWins = results.filter((r) => !r.mentioned && r.competitor_mentions?.includes(competitor.name)).length

  const whyWins = results
    .filter((r) => r.why_competitor_wins && r.competitor_mentions?.includes(competitor.name))
    .map((r) => r.why_competitor_wins)
    .slice(0, 5)

  const { data: compContent } = await admin
    .from('competitor_content')
    .select('title, url, likely_cited')
    .eq('competitor_id', competitor_id)
    .limit(10)

  const { data: compAds } = await admin
    .from('competitor_ads')
    .select('platform, ad_text')
    .eq('competitor_id', competitor_id)
    .eq('is_active', true)
    .limit(5)

  const dataBrief = `
COMPETITOR: ${competitor.name} (${competitor.domain || 'no domain'})
CLIENT: ${client.name} (${client.industry || 'general'})

AI MENTION RATES (last 30 days):
- ${competitor.name}: ${compRate}% (${compMentions} of ${results.length} results)
- ${client.name}: ${clientRate}% (${clientMentions} of ${results.length} results)

PROMPTS WHERE COMPETITOR WINS: ${promptsCompWins}

WHY AI MODELS RECOMMEND THEM:
${whyWins.length > 0 ? whyWins.map((w, i) => `${i + 1}. ${w}`).join('\n') : 'No specific data'}

COMPETITOR CONTENT (${(compContent || []).length} pages crawled):
${(compContent || []).map((c) => `- ${c.title} ${c.likely_cited ? '(LIKELY CITED)' : ''}: ${c.url}`).join('\n') || 'Not crawled'}

ACTIVE ADS (${(compAds || []).length}):
${(compAds || []).map((a) => `- [${a.platform}] ${a.ad_text?.slice(0, 100)}`).join('\n') || 'None found'}
`.trim()

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 2048,
    system: `You are a senior competitive intelligence analyst briefing a consultant.
Write a clear, direct competitive brief covering:
1. Who this competitor is and why AI models recommend them
2. What content/signals drive their AI visibility
3. Their growth trajectory (accelerating, flat, declining)
4. Specific weaknesses and gaps our client can exploit
5. The 3 highest-impact actions to take market share from them

Tone: Direct, confident, analyst-quality. Specific numbers from data.
Write as if you are the smartest consultant in the room.
500 words maximum. Use markdown headers (##).`,
    messages: [{ role: 'user', content: `Write a competitive brief:\n\n${dataBrief}` }],
  })

  const brief = response.content[0].type === 'text' ? response.content[0].text : ''

  return NextResponse.json({ brief, metrics: { clientRate, compRate, promptsCompWins } })
}
