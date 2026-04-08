'use client'

import { ClientProvider } from '@/hooks/useClient'

export function ClientProviderWrapper({
  children,
  workspaceId,
}: {
  children: React.ReactNode
  workspaceId: string | null
}) {
  return (
    <ClientProvider workspaceId={workspaceId}>
      {children}
    </ClientProvider>
  )
}
