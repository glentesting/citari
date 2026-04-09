import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      redirect('/overview')
    }
  } catch {
    // Not authenticated or Supabase not configured — show landing page
  }

  // Redirect to marketing home
  redirect('/home')
}
