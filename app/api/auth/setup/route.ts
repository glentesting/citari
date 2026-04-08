import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Uses service role key to create workspace + settings on behalf of new user
export async function POST(request: Request) {
  const { userId } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Create workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ owner_id: userId })
    .select()
    .single()

  if (wsError) {
    return NextResponse.json({ error: wsError.message }, { status: 500 })
  }

  // Create user_settings
  const { error: settingsError } = await supabase
    .from('user_settings')
    .insert({
      user_id: userId,
      workspace_id: workspace.id,
    })

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 })
  }

  return NextResponse.json({ workspace_id: workspace.id })
}
