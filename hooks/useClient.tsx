'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Client } from '@/types'

interface ClientContextType {
  clients: Client[]
  activeClient: Client | null
  setActiveClient: (client: Client) => void
  refreshClients: () => Promise<void>
  loading: boolean
}

const ClientContext = createContext<ClientContextType>({
  clients: [],
  activeClient: null,
  setActiveClient: () => {},
  refreshClients: async () => {},
  loading: true,
})

export function ClientProvider({
  children,
  workspaceId,
}: {
  children: ReactNode
  workspaceId: string | null
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [activeClient, setActiveClientState] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refreshClients = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (data) {
      setClients(data)

      // Restore active client from localStorage or pick the first one
      const storedId = localStorage.getItem('citari_active_client')
      const stored = storedId ? data.find((c) => c.id === storedId) : null
      if (stored) {
        setActiveClientState(stored)
      } else if (data.length > 0 && !activeClient) {
        setActiveClientState(data[0])
        localStorage.setItem('citari_active_client', data[0].id)
      }
    }

    setLoading(false)
  }, [workspaceId, supabase, activeClient])

  useEffect(() => {
    refreshClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const setActiveClient = useCallback(
    async (client: Client) => {
      setActiveClientState(client)
      localStorage.setItem('citari_active_client', client.id)

      // Persist to user_settings
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('user_settings')
          .update({ active_client_id: client.id })
          .eq('user_id', user.id)
      }
    },
    [supabase]
  )

  return (
    <ClientContext.Provider
      value={{ clients, activeClient, setActiveClient, refreshClients, loading }}
    >
      {children}
    </ClientContext.Provider>
  )
}

export function useClient() {
  return useContext(ClientContext)
}
