import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { fetchPageContent } from '@/lib/competitors/crawl'

export const maxDuration = 30

export async function POST(request: Request) {
  const { domain } = await request.json()
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')

  // Crawl homepage + a few internal pages
  const homeUrl = `https://${cleanDomain}`
  const homePage = await fetchPageContent(homeUrl)

  if (!homePage) {
    // Try with www
    const wwwPage = await fetchPageContent(`https://www.${cleanDomain}`)
    if (!wwwPage) {
      return NextResponse.json({ error: 'Could not access website' }, { status: 404 })
    }
    return analyzeContent(wwwPage.title, wwwPage.excerpt)
  }

  // Try to grab a couple more pages for richer context
  let allContent = `PAGE: ${homePage.title}\n${homePage.excerpt}\n\n`

  const internalLinks = extractInternalLinks(homePage.excerpt, cleanDomain)
  const extraPages = internalLinks.slice(0, 3)

  const extraResults = await Promise.all(
    extraPages.map((url) => fetchPageContent(url).catch(() => null))
  )

  for (const page of extraResults) {
    if (page) {
      allContent += `PAGE: ${page.title}\n${page.excerpt.slice(0, 500)}\n\n`
    }
  }

  return analyzeContent(homePage.title, allContent)
}

function extractInternalLinks(text: string, domain: string): string[] {
  // The excerpt is plain text (tags stripped), so try common subpage patterns
  const cleanDomain = domain.replace(/^www\./, '')
  return [
    `https://${cleanDomain}/about`,
    `https://${cleanDomain}/services`,
    `https://${cleanDomain}/practice-areas`,
    `https://www.${cleanDomain}/about`,
  ]
}

async function analyzeContent(title: string, content: string): Promise<NextResponse> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 512,
      system: `You are analyzing a business website to extract key information. Based on the website content provided, extract:

1. description: A concise 1-2 sentence description of what this business does and who their clients are
2. specialization: Their specific practice areas, services, or specializations (comma-separated)
3. location: Cities, states, or regions they serve (comma-separated)

If you cannot determine a field from the content, return an empty string for it. Do NOT guess or make up information.

Return ONLY valid JSON: {"description":"...","specialization":"...","location":"..."}`,
      messages: [{
        role: 'user',
        content: `Website title: ${title}\n\nWebsite content:\n${content.slice(0, 4000)}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return NextResponse.json({
        description: parsed.description || '',
        specialization: parsed.specialization || '',
        location: parsed.location || '',
      })
    }
    return NextResponse.json({ description: '', specialization: '', location: '' })
  } catch (e: any) {
    console.error('Domain analysis AI call failed:', e)
    return NextResponse.json({ description: '', specialization: '', location: '' })
  }
}
