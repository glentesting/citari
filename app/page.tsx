import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  let isAuthenticated = false

  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUser()
    if (!error && data?.user) {
      isAuthenticated = true
    }
  } catch {
    // Supabase not configured or error — treat as unauthenticated
  }

  if (isAuthenticated) {
    redirect('/overview')
  }

  redirect('/home')
}
