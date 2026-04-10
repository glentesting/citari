import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { buildClientContext } from '@/lib/utils'

export const maxDuration = 60

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

  // Fetch client info
  const { data: client } = await adminSupabase
    .from('clients')
    .select('name, domain, industry, location, specialization, description')
    .eq('id', client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const clientContext = buildClientContext(client)

  // Fetch competitors
  const { data: competitors } = await adminSupabase
    .from('competitors')
    .select('name')
    .eq('client_id', client_id)

  const competitorNames = (competitors || []).map((c) => c.name)

  // Fetch existing prompts to avoid duplicates
  const { data: existingPrompts } = await adminSupabase
    .from('prompts')
    .select('text')
    .eq('client_id', client_id)

  const existingTexts = (existingPrompts || []).map((p) => p.text.toLowerCase())

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are an AI visibility strategist. Given detailed business context and a list of competitors, generate the 15 most important prompts that BUYERS in this specific category are asking AI models like ChatGPT, Claude, and Gemini when researching solutions.

CRITICAL: The prompts MUST be specific to this business's exact specialization, services, and location. Do NOT generate generic industry prompts. Every prompt should reflect what a real potential client of THIS specific business would type.

Distribute across:
- 6 awareness prompts ("what is...", "how does...", "best practices for...")
- 6 evaluation prompts ("best [specific category] for...", "[company] vs [competitor]", "alternatives to...")
- 3 purchase prompts ("[company] pricing", "[company] reviews", "is [company] worth it")

Return ONLY valid JSON in this exact format:
{"prompts": [{"text": "...", "category": "awareness|evaluation|purchase", "reasoning": "..."}]}`

  const userPrompt = `Business: ${clientContext}
Domain: ${client.domain || 'Not provided'}
Competitors: ${competitorNames.length > 0 ? competitorNames.join(', ') : 'None specified'}

Generate 15 tracking prompts for this specific business. Every prompt must be relevant to their exact specialization and location.`

  const response = await anthropic.messages.create({
    model: MODELS.haiku,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = response.content[0]
  const text = block.type === 'text' ? block.text : ''

  // Parse JSON from response (handle markdown code blocks)
  let parsed: { prompts: { text: string; category: string; reasoning: string }[] }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
  } catch (e) {
    console.error('Failed to parse suggest-prompts AI response:', e)
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  // Filter out prompts that already exist
  const suggestions = parsed.prompts.filter(
    (p) => !existingTexts.includes(p.text.toLowerCase())
  )

  return NextResponse.json({ suggestions })
}
