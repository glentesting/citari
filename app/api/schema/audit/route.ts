import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const maxDuration = 60

interface SchemaAuditResult {
  url: string
  schemasFound: { type: string; valid: boolean }[]
  missing: string[]
  recommendations: string[]
}

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

  const { domain } = await request.json()
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

  const pagesToCheck = [
    `https://${domain}`,
    `https://${domain}/about`,
    `https://${domain}/services`,
    `https://${domain}/contact`,
    `https://www.${domain}`,
  ]

  const results: SchemaAuditResult[] = []

  for (const url of pagesToCheck) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Citari/1.0)' },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      })
      if (!res.ok) continue

      const html = await res.text()

      // Find JSON-LD script tags
      const ldMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || []

      const schemasFound: { type: string; valid: boolean }[] = []
      for (const match of ldMatches) {
        const jsonMatch = match.match(/>([^<]+)</)?.[1]
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch)
            const schemaType = parsed['@type'] || 'Unknown'
            schemasFound.push({ type: schemaType, valid: true })
          } catch {
            schemasFound.push({ type: 'Invalid JSON', valid: false })
          }
        }
      }

      // Determine what's missing
      const foundTypes = schemasFound.map((s) => s.type.toLowerCase())
      const missing: string[] = []
      const recommendations: string[] = []

      if (!foundTypes.some((t) => t.includes('organization') || t.includes('localbusiness'))) {
        missing.push('Organization/LocalBusiness')
        recommendations.push('Add Organization or LocalBusiness schema to your homepage — AI models use this to verify business identity.')
      }
      if (!foundTypes.some((t) => t.includes('faq'))) {
        missing.push('FAQPage')
        recommendations.push('Add FAQ schema to content pages — this is the #1 most-cited schema type by AI models.')
      }
      if (!foundTypes.some((t) => t.includes('breadcrumb'))) {
        missing.push('BreadcrumbList')
        recommendations.push('Add BreadcrumbList schema for better page hierarchy signals.')
      }
      if (url.includes('/about') && !foundTypes.some((t) => t.includes('person') || t.includes('organization'))) {
        recommendations.push('Your About page should have Organization schema with founders/team info.')
      }

      results.push({
        url: res.url, // use final URL after redirects
        schemasFound,
        missing,
        recommendations,
      })
    } catch {
      continue
    }
  }

  // Compute overall score
  const totalPages = results.length
  const pagesWithSchema = results.filter((r) => r.schemasFound.length > 0).length
  const totalMissing = results.reduce((sum, r) => sum + r.missing.length, 0)
  const score = totalPages > 0
    ? Math.max(0, Math.round(((pagesWithSchema / totalPages) * 70) + ((1 - totalMissing / (totalPages * 3)) * 30)))
    : 0

  return NextResponse.json({ score, results, pagesChecked: totalPages })
}
