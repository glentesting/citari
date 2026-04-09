import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import { ClientProviderWrapper } from '@/components/layout/ClientProviderWrapper'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  let workspaceId: string | null = null
  const { data: settings } = await supabase
    .from('user_settings')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()
  workspaceId = settings?.workspace_id ?? null

  return (
    <ClientProviderWrapper workspaceId={workspaceId}>
      <div className="flex h-screen bg-[#F9FAFB]">
        <Sidebar userEmail={user.email} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </ClientProviderWrapper>
  )
}
