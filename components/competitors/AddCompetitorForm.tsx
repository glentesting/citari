'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface AddCompetitorFormProps {
  onAdded: () => void
}

export default function AddCompetitorForm({ onAdded }: AddCompetitorFormProps) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { activeClient } = useClient()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeClient) return

    setLoading(true)
    setError(null)

    const { error: insertError } = await supabase
      .from('competitors')
      .insert({
        client_id: activeClient.id,
        name: name.trim(),
        domain: domain.trim() || null,
      })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setName('')
    setDomain('')
    setLoading(false)
    onAdded()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Competitor</h3>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            placeholder="Acme Corp"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Domain</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            placeholder="acme.com"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !name.trim() || !activeClient}
          className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? 'Adding...' : 'Add'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </form>
  )
}
