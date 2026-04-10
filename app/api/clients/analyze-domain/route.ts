import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { fetchPageContent } from '@/lib/competitors/crawl'

export const maxDuration = 30

export async function POST(request: Request) {
  const { domain } = await request.json()
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

  const cleanDomain = domain.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')

  // Crawl homepage
  let homePage = await fetchPageContent(`https://${cleanDomain}`)
  if (!homePage) homePage = await fetchPageContent(`https://www.${cleanDomain}`)
  if (!homePage) {
    return NextResponse.json({ error: 'Could not access website' }, { status: 404 })
  }

  // Crawl subpages in parallel for richer context
  const subpages = ['/about', '/services', '/practice-areas', '/what-we-do', '/our-team']
  const base = new URL(homePage.url).origin
  const subResults = await Promise.all(
    subpages.map((path) => fetchPageContent(`${base}${path}`).catch(() => null))
  )

  let allContent = `PAGE: ${homePage.title}\n${homePage.excerpt}\n\n`
  for (const page of subResults) {
    if (page) {
      allContent += `PAGE: ${page.title}\n${page.excerpt.slice(0, 800)}\n\n`
    }
  }

  // Analyze with Claude
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1024,
      system: `You are a business intelligence analyst. Analyze this website content and extract a complete business profile. Return ONLY valid JSON:
{
  "name": "string",
  "description": "string (2-3 sentences, what they do and who they serve)",
  "specialization": "string (their specific niche or practice areas, comma separated)",
  "location": "string (all locations/states they serve, comma separated)",
  "target_clients": "string (who their ideal customers are)",
  "differentiators": "string (what makes them different from competitors)",
  "industry": "string (one word or short phrase)"
}

If you cannot determine a field from the content, return an empty string for it. Do NOT guess or fabricate information not present in the content.`,
      messages: [{
        role: 'user',
        content: `Domain: ${cleanDomain}\nWebsite title: ${homePage.title}\n\nWebsite content:\n${allContent.slice(0, 6000)}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
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
