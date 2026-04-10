import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { buildClientContext, fetchWithTimeout } from '@/lib/utils'

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
    .select('name, domain, industry, location, specialization, description, target_clients, differentiators')
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

  // Discover real buyer questions via Serper People Also Ask
  let paaQuestions: string[] = []
  const serperKey = process.env.SERPER_API_KEY
  if (serperKey) {
    const industry = client.specialization || client.industry || client.name
    const location = client.location || ''
    const seedQueries = [
      `${industry} ${location}`.trim(),
      `best ${industry} near me`,
      `how to choose ${industry}`,
    ]

    for (const q of seedQueries.slice(0, 2)) {
      try {
        const res = await fetchWithTimeout('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q, gl: 'us', hl: 'en', num: 5 }),
          timeoutMs: 8000,
        })
        if (res.ok) {
          const data = await res.json()
          for (const paa of (data.peopleAlsoAsk || [])) {
            if (paa.question && !existingTexts.includes(paa.question.toLowerCase())) {
              paaQuestions.push(paa.question)
            }
          }
        }
      } catch (e) {
        console.error('Serper PAA fetch failed:', e)
      }
    }
    paaQuestions = [...new Set(paaQuestions)].slice(0, 10)
  }

  const paaContext = paaQuestions.length > 0
    ? `\n\nREAL BUYER QUESTIONS from Google "People Also Ask" (incorporate these — they are proven search queries):\n${paaQuestions.map((q) => `- "${q}"`).join('\n')}`
    : ''

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are an AI visibility strategist. Generate the 15 most important prompts that BUYERS ask AI models when researching this type of business.

CRITICAL: Prompts MUST be specific to this business's exact specialization, services, and location. Do NOT generate generic industry prompts. If real buyer questions from Google are provided, prioritize adapting those — they represent proven search demand.

Distribute across:
- 6 awareness prompts ("what is...", "how does...", "best practices for...")
- 6 evaluation prompts ("best [specific category] for...", "[company] vs [competitor]", "alternatives to...")
- 3 purchase prompts ("[company] pricing", "[company] reviews", "is [company] worth it")

Return ONLY valid JSON:
{"prompts": [{"text": "...", "category": "awareness|evaluation|purchase", "reasoning": "...", "source": "ai_generated|people_also_ask"}]}`

  const userPrompt = `Business: ${clientContext}
Domain: ${client.domain || 'Not provided'}
Competitors: ${competitorNames.length > 0 ? competitorNames.join(', ') : 'None specified'}${paaContext}

Generate 15 tracking prompts. Prioritize real buyer questions if provided.`

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
