import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { buildClientContext } from '@/lib/utils'

const LOCAL_KEYWORDS = [
  'roofing', 'plumbing', 'hvac', 'dental', 'dentist', 'restaurant', 'law firm',
  'attorney', 'lawyer', 'landscaping', 'cleaning', 'pest control', 'electrician',
  'auto repair', 'mechanic', 'salon', 'barbershop', 'chiropractic', 'veterinary',
  'vet', 'real estate', 'realtor', 'insurance', 'accounting', 'cpa', 'moving',
  'storage', 'gym', 'fitness', 'daycare', 'preschool', 'tutoring', 'photography',
  'florist', 'bakery', 'catering', 'printing', 'construction', 'remodeling',
  'painting', 'fencing', 'pool', 'garage door', 'locksmith', 'towing',
]

function isLocalBusiness(industry: string | null, name: string): boolean {
  const text = `${industry || ''} ${name}`.toLowerCase()
  return LOCAL_KEYWORDS.some((kw) => text.includes(kw))
}

export async function POST(request: Request) {
  const cookieStore = cookies()

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

  const { client_id } = await request.json()
  if (!client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: client } = await adminSupabase
    .from('clients')
    .select('name, domain, industry, location, specialization, description, target_clients, differentiators')
    .eq('id', client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const clientContext = buildClientContext(client)
  const isLocal = isLocalBusiness(client.industry, client.name)

  const systemPrompt = isLocal
    ? `You are a competitive intelligence analyst specializing in local and regional businesses. Given a local business name, domain, and industry, identify the 5 most likely direct competitors.

For local/service businesses:
- Focus on same-category competitors, NOT national brands
- Suggest competitors that would realistically compete for the same local customers
- Include both established local players and emerging competitors
- If you can infer the region from the domain or name, focus on that area

Return ONLY valid JSON in this exact format:
{"competitors": [{"name": "...", "domain": "...", "reason": "..."}]}

For domain, give your best guess at their website domain. If unsure, use null.
Keep reasons concise (one sentence).`
    : `You are a competitive intelligence analyst. Given a company name, domain, and industry, identify the 5 most significant competitors that would appear alongside this brand in AI model responses.

Focus on:
- Direct competitors in the same product/service category
- Companies that buyers would compare against when evaluating solutions
- Competitors that AI models (ChatGPT, Claude, Gemini) are most likely to mention
- Mix of established leaders and rising challengers

Return ONLY valid JSON in this exact format:
{"competitors": [{"name": "...", "domain": "...", "reason": "..."}]}

For domain, give your best guess at their website domain. If unsure, use null.
Keep reasons concise (one sentence).`

  const userPrompt = `Business: ${clientContext}
Domain: ${client.domain || 'Not provided'}

Identify the top 5 competitors for this specific business.`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let text: string
  try {
    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const block = response.content[0]
    text = block.type === 'text' ? block.text : ''
  } catch (e: any) {
    console.error('Competitor discovery AI call failed:', e)
    return NextResponse.json({ error: 'AI call failed — please try again' }, { status: 502 })
  }

  let parsed: { competitors: { name: string; domain: string | null; reason: string }[] }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
  } catch (e) {
    console.error('Failed to parse competitor discovery AI response:', e)
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  return NextResponse.json({ competitors: parsed.competitors, isLocal })
}
