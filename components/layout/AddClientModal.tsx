'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface AddClientModalProps {
  onClose: () => void
}

export default function AddClientModal({ onClose }: AddClientModalProps) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { refreshClients, setActiveClient } = useClient()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Get workspace_id from user_settings
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!settings?.workspace_id) {
      setError('No workspace found')
      setLoading(false)
      return
    }

    const { data: client, error: insertError } = await supabase
      .from('clients')
      .insert({
        workspace_id: settings.workspace_id,
        name,
        domain: domain || null,
        industry: industry || null,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    await refreshClients()
    if (client) {
      setActiveClient(client)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add new client</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
              Client name <span className="text-red-500">*</span>
            </label>
            <input
              id="clientName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="Acme Corp"
            />
          </div>

          <div>
            <label htmlFor="clientDomain" className="block text-sm font-medium text-gray-700 mb-1">
              Domain
            </label>
            <input
              id="clientDomain"
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="acme.com"
            />
          </div>

          <div>
            <label htmlFor="clientIndustry" className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            <input
              id="clientIndustry"
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="SaaS, Marketing, etc."
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
