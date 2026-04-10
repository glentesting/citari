import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { fetchWithTimeout } from '@/lib/utils'

export const maxDuration = 30

export async function POST(request: Request) {
  const { domain } = await request.json()
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

  const cleanDomain = domain.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')

  // Fetch homepage only — fast, no subpage crawling
  let html = ''
  let pageTitle = cleanDomain
  for (const prefix of [`https://${cleanDomain}`, `https://www.${cleanDomain}`]) {
    try {
      const res = await fetchWithTimeout(prefix, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Citari/1.0)' },
        timeoutMs: 8000,
        redirect: 'follow',
      })
      if (!res.ok) continue
      html = await res.text()

      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      if (titleMatch) pageTitle = titleMatch[1].replace(/\s+/g, ' ').trim()
      break
    } catch {
      continue
    }
  }

  if (!html) {
    return NextResponse.json({ error: 'Could not access website' }, { status: 404 })
  }

  // Strip to text content — fast extraction, no heavy parsing
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000)

  // Analyze with Claude
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 512,
      system: `You are a business intelligence analyst. Analyze this website content and extract a complete business profile. Return ONLY valid JSON:
{
  "name": "business name",
  "description": "2-3 sentences, what they do and who they serve",
  "specialization": "specific niche or practice areas, comma separated",
  "location": "all locations/states they serve, comma separated",
  "target_clients": "who their ideal customers are",
  "differentiators": "what makes them different",
  "industry": "one word or short phrase"
}

Extract only what is clearly stated in the content. Return empty string for fields you cannot determine.`,
      messages: [{
        role: 'user',
        content: `Domain: ${cleanDomain}\nTitle: ${pageTitle}\n\nContent:\n${text}`,
      }],
    })

    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = responseText.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return NextResponse.json({
        name: parsed.name || '',
        description: parsed.description || '',
        specialization: parsed.specialization || '',
        location: parsed.location || '',
        target_clients: parsed.target_clients || '',
        differentiators: parsed.differentiators || '',
        industry: parsed.industry || '',
      })
    }
    return NextResponse.json({ error: 'Could not analyze website content' }, { status: 500 })
  } catch (e: any) {
    console.error('Domain analysis AI call failed:', e)
    return NextResponse.json({ error: 'Analysis failed — please try again' }, { status: 502 })
  }
}
