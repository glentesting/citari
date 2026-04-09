import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import { ClientProviderWrapper } from '@/components/layout/ClientProviderWrapper'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user: any = null
  let workspaceId: string | null = null

  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (error: any) {
    // Supabase env vars missing — redirect to login
    console.error('Dashboard layout error:', error?.message)
    redirect('/login')
  }

  if (!user) {
    redirect('/login')
  }

  try {
    const supabase = createClient()
    const { data: settings } = await supabase
      .from('user_settings')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()
    workspaceId = settings?.workspace_id ?? null
  } catch {
    // Settings fetch failed — continue with null workspace
  }

  return (
    <ClientProviderWrapper workspaceId={workspaceId}>
      <div className="flex h-screen bg-[#F9FAFB]">
        <Sidebar userEmail={user.email} userName={user.user_metadata?.full_name || user.user_metadata?.first_name || undefined} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </ClientProviderWrapper>
  )
}
