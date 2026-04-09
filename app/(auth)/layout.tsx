import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      redirect('/overview')
    }
  } catch (error: any) {
    // If Supabase env vars are missing, let the page render anyway
    // so the user sees the login form (which will show its own error)
    if (!error?.message?.includes('NEXT_REDIRECT')) {
      console.error('Auth layout error:', error?.message)
    } else {
      // Re-throw redirect errors — Next.js uses thrown errors for redirects
      throw error
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-6">
        {children}
      </div>
    </div>
  )
}
