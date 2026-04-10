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

  const { client_id, schema_type, page_url, source_content } = await request.json()
  if (!client_id || !schema_type) {
    return NextResponse.json({ error: 'client_id and schema_type required' }, { status: 400 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: client } = await admin.from('clients').select('name, domain, industry').eq('id', client_id).single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // For FAQ: fetch existing GEO content if no source_content provided
  let contentContext = source_content || ''
  if (schema_type === 'faq' && !contentContext) {
    const { data: geoContent } = await admin
      .from('geo_content')
      .select('title, content')
      .eq('client_id', client_id)
      .eq('status', 'published')
      .limit(3)
    if (geoContent && geoContent.length > 0) {
      contentContext = geoContent.map((g) => `${g.title}\n${g.content}`).join('\n\n---\n\n')
    }
  }

  const typeDescriptions: Record<string, string> = {
    faq: 'FAQPage schema with Question/Answer pairs. Extract or generate 5-8 relevant Q&As.',
    organization: 'Organization schema with name, url, logo, description, contact, social profiles.',
    localbusiness: 'LocalBusiness schema with name, address, phone, hours, geo coordinates, priceRange.',
    article: 'Article schema with headline, author, datePublished, image, description.',
    review: 'AggregateRating and Review schema with ratings, review count, best/worst rating.',
    breadcrumb: 'BreadcrumbList schema for the page navigation path.',
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let text: string
  try {
    const response = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 800,
      system: `Generate valid JSON-LD schema markup for ${typeDescriptions[schema_type] || schema_type}.
The schema must be:
1. Valid according to schema.org specification
2. Optimized for AI model citation — include all recommended properties
3. Include specific data provided, fill gaps with best practices
4. Return ONLY the raw JSON object, no markdown, no explanation, no script tags

Business: ${client.name}
Domain: ${client.domain || 'not provided'}
Industry: ${client.industry || 'not specified'}
Page URL: ${page_url || (client.domain ? `https://${client.domain}` : 'not provided')}`,
      messages: [{
        role: 'user',
        content: contentContext
          ? `Generate ${schema_type} schema based on this content:\n\n${contentContext.slice(0, 3000)}`
          : `Generate ${schema_type} schema for ${client.name} (${client.industry || 'general business'}).`,
      }],
    })
    text = response.content[0].type === 'text' ? response.content[0].text : ''
  } catch (e: any) {
    console.error('Schema generation AI call failed:', e)
    return NextResponse.json({ error: 'AI generation failed — please try again' }, { status: 502 })
  }

  // Extract JSON from response (might be wrapped in script tags or code blocks)
  let schemaJson: any
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    schemaJson = jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch (e) {
    console.error('Failed to parse generated schema JSON:', e)
    return NextResponse.json({ error: 'Failed to parse generated schema' }, { status: 500 })
  }

  if (!schemaJson) {
    return NextResponse.json({ error: 'No valid schema generated' }, { status: 500 })
  }

  // Save to schema_markup table
  const { data: saved, error: saveError } = await admin
    .from('schema_markup')
    .insert({
      client_id,
      page_url: page_url || (client.domain ? `https://${client.domain}` : null),
      schema_type,
      schema_json: schemaJson,
      is_deployed: false,
    })
    .select()
    .single()

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 })

  return NextResponse.json({ id: saved.id, schema_json: schemaJson })
}
