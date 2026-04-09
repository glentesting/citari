import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkNAPConsistency, calculateNAPScore } from '@/lib/local/nap'

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

  const { client_id } = await request.json()
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: client } = await admin.from('clients').select('name, domain').eq('id', client_id).single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const checks = await checkNAPConsistency({
    name: client.name,
    website: client.domain ? `https://${client.domain}` : undefined,
  })

  // Delete old and insert fresh
  await admin.from('nap_listings').delete().eq('client_id', client_id)

  if (checks.length > 0) {
    const rows = checks.map((c) => ({
      client_id,
      directory: c.directory,
      listed_name: c.listed_name,
      listed_address: c.listed_address,
      listed_phone: c.listed_phone,
      listed_website: c.listed_website,
      is_consistent: c.is_consistent,
      issues: c.issues,
    }))
    await admin.from('nap_listings').insert(rows)
  }

  const score = calculateNAPScore(checks)

  return NextResponse.json({ score, checks: checks.length, consistent: checks.filter((c) => c.is_consistent).length })
}
