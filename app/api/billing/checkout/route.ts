import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createCheckoutSession, type PlanId } from '@/lib/billing/stripe'

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

  const { plan } = await request.json()
  if (!['starter', 'professional', 'agency'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: settings } = await admin.from('user_settings').select('workspace_id').eq('user_id', user.id).single()
  if (!settings?.workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  try {
    const url = await createCheckoutSession(
      settings.workspace_id,
      plan as PlanId,
      user.email!,
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing&success=true`,
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing&cancelled=true`
    )
    return NextResponse.json({ url })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
