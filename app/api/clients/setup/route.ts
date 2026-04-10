import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(request: Request) {
  const log: string[] = []

  try {
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
    if (!user) return NextResponse.json({ error: 'Unauthorized', log }, { status: 401 })
    log.push('Auth OK: ' + user.id)

    const { client_id } = await request.json()
    if (!client_id) return NextResponse.json({ error: 'client_id required', log }, { status: 400 })
    log.push('Client ID: ' + client_id)

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    log.push('Admin client created')

    // Fetch client
    const { data: client, error: clientError } = await admin
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single()

    if (clientError) {
      log.push('Client fetch ERROR: ' + clientError.message)
      return NextResponse.json({ error: clientError.message, log }, { status: 500 })
    }
    if (!client) {
      log.push('Client not found')
      return NextResponse.json({ error: 'Client not found', log }, { status: 404 })
    }

    log.push('Client found: ' + JSON.stringify(client))

    // Test competitor insert with new columns
    const { data: inserted, error: insertError } = await admin
      .from('competitors')
      .insert({
        client_id,
        name: 'TEST COMPETITOR',
        domain: 'test.com',
        intel_brief: 'test brief',
        why_winning: 'test why',
        content_gaps: 'test gaps',
        visibility_score: 50,
      })
      .select()
      .single()

    if (insertError) {
      log.push('Competitor insert ERROR: ' + insertError.message)
    } else {
      log.push('Competitor insert OK: ' + JSON.stringify(inserted))
      // Clean up test data
      if (inserted?.id) {
        await admin.from('competitors').delete().eq('id', inserted.id)
        log.push('Test competitor deleted')
      }
    }

    return NextResponse.json({ success: true, log })
  } catch (e: any) {
    log.push('TOP-LEVEL CRASH: ' + e.message)
    return NextResponse.json({ error: e.message, log }, { status: 500 })
  }
}
