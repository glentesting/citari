'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface AddPromptFormProps {
  onAdded: () => void
}

export default function AddPromptForm({ onAdded }: AddPromptFormProps) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<'awareness' | 'evaluation' | 'purchase'>('awareness')
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
      .from('prompts')
      .insert({
        client_id: activeClient.id,
        text: text.trim(),
        category,
      })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setText('')
    setCategory('awareness')
    setLoading(false)
    onAdded()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Add a tracking prompt</h3>
      <p className="text-xs text-gray-500 mb-4">
        Enter a prompt that a user might ask an AI model about your client&apos;s industry. We&apos;ll check if the AI mentions your brand.
      </p>

      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
          placeholder='e.g. "What are the best project management tools for small teams?"'
        />

        <div className="flex items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as 'awareness' | 'evaluation' | 'purchase')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
          >
            <option value="awareness">Awareness</option>
            <option value="evaluation">Evaluation</option>
            <option value="purchase">Purchase</option>
          </select>

          <button
            type="submit"
            disabled={loading || !text.trim() || !activeClient}
            className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50 ml-auto"
          >
            {loading ? 'Adding...' : 'Add prompt'}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  )
}
