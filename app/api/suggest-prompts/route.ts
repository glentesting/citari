import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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
    .select('name, domain, industry')
    .eq('id', client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

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

  const systemPrompt = `You are an AI visibility strategist. Given a company name, industry, and list of competitors, generate the 40 most important prompts that buyers in this category are asking AI models like ChatGPT, Claude, and Gemini when researching solutions.

Distribute across:
- 15 awareness prompts ("what is...", "how does...", "best practices for...")
- 15 evaluation prompts ("best [category] for...", "[company] vs [competitor]", "alternatives to...")
- 10 purchase prompts ("[company] pricing", "[company] reviews", "is [company] worth it")

Return ONLY valid JSON in this exact format:
{"prompts": [{"text": "...", "category": "awareness|evaluation|purchase", "reasoning": "..."}]}`

  const userPrompt = `Company: ${client.name}${client.domain ? ` (${client.domain})` : ''}
Industry: ${client.industry || 'Not specified'}
Competitors: ${competitorNames.length > 0 ? competitorNames.join(', ') : 'None specified'}

Generate 40 tracking prompts for this company.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 4096,
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
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  // Filter out prompts that already exist
  const suggestions = parsed.prompts.filter(
    (p) => !existingTexts.includes(p.text.toLowerCase())
  )

  return NextResponse.json({ suggestions })
}
