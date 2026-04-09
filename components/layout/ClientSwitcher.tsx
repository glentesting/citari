'use client'

import { useState, useRef, useEffect } from 'react'
import { useClient } from '@/hooks/useClient'
import AddClientModal from '@/components/layout/AddClientModal'

export default function ClientSwitcher() {
  const { clients, activeClient, setActiveClient, loading } = useClient()
  const [open, setOpen] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        onClick={() => setOpen(!open)}
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
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
          {clients.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">No clients yet</p>
          ) : (
            clients.map((client) => (
              <button
                key={client.id}
                onClick={() => {
                  setActiveClient(client)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                  activeClient?.id === client.id
                    ? 'bg-brand-bg text-brand font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
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
                {client.domain && (
                  <span className="text-xs text-gray-400 truncate">{client.domain}</span>
                )}
              </button>
            ))
          )}

          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => {
                setOpen(false)
                setShowAddModal(true)
              }}
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
