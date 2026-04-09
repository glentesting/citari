'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import AddClientModal from '@/components/layout/AddClientModal'

export default function ClientSwitcher() {
  const { clients, activeClient, setActiveClient, refreshClients, loading } = useClient()
  const [open, setOpen] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleDelete(clientId: string) {
    try {
      const res = await fetch('/api/clients/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to delete')
        return
      }
    } catch {
      alert('Delete failed')
      return
    }
    setConfirmDeleteId(null)
    if (activeClient?.id === clientId) {
      localStorage.removeItem('citari_active_client')
    }
    await refreshClients()
  }

  if (loading) {
    return (
      <div className="w-full px-3 py-2 text-sm text-gray-400 bg-gray-50 rounded-lg border border-gray-200 animate-pulse">
        Loading...
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setConfirmDeleteId(null) }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
      >
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008V7.5Z" />
        </svg>
        <span className="flex-1 text-left truncate">
          {activeClient ? activeClient.name : 'Select a client...'}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
          {clients.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">No clients yet</p>
          ) : (
            clients.map((client) => {
              const isActive = activeClient?.id === client.id
              const isConfirming = confirmDeleteId === client.id

              if (isConfirming) {
                return (
                  <div key={client.id} className="px-3 py-2 bg-red-50 border-b border-red-100">
                    <p className="text-xs font-medium text-red-700 mb-2">
                      Delete {client.name} and all data?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="px-3 py-1 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700"
                      >
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={client.id}
                  className={`flex items-center px-1 ${isActive ? 'bg-brand-bg' : 'hover:bg-gray-50'}`}
                >
                  <button
                    onClick={() => { setActiveClient(client); setOpen(false) }}
                    className={`flex-1 text-left px-2 py-2 text-sm transition-colors flex items-center gap-2 ${
                      isActive ? 'text-brand font-medium' : 'text-gray-700'
                    }`}
                  >
                    {client.avatar_url ? (
                      <img src={client.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-brand-bg text-brand text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {(client.name || '?')[0]}
                      </span>
                    )}
                    <span className="truncate">{client.name}</span>
                    {isActive && (
                      <span className="ml-auto text-[10px] text-brand-dark bg-brand-bg px-1.5 py-0.5 rounded-full">active</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDeleteId(client.id)
                    }}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Delete client"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              )
            })
          )}

          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); setShowAddModal(true) }}
              className="w-full text-left px-3 py-2 text-sm text-brand font-medium hover:bg-brand-bg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add new client
            </button>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddClientModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  )
}
