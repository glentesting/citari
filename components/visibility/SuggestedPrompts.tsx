'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface Suggestion {
  text: string
  category: string
  reasoning: string
}

interface SuggestedPromptsProps {
  onAdded: () => void
}

const categoryLabels: Record<string, { label: string; bg: string; text: string }> = {
  awareness: { label: 'Awareness', bg: 'bg-blue-50', text: 'text-blue-700' },
  evaluation: { label: 'Evaluation', bg: 'bg-amber-50', text: 'text-amber-700' },
  purchase: { label: 'Purchase', bg: 'bg-green-50', text: 'text-green-700' },
}

export default function SuggestedPrompts({ onAdded }: SuggestedPromptsProps) {
  const { activeClient } = useClient()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set())
  const [addingAll, setAddingAll] = useState(false)
  const supabase = createClient()

  async function generateSuggestions() {
    if (!activeClient) return
    setLoading(true)
    setError(null)
    setSuggestions([])
    setAddedIds(new Set())

    try {
      const res = await fetch('/api/suggest-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id }),
      })
      const text = await res.text()
      if (!text) { setError('Server timed out — try again'); setLoading(false); return }
      const data = JSON.parse(text)
      if (!res.ok) {
        setError(data.error || 'Failed to generate suggestions')
      } else {
        setSuggestions(data.suggestions || [])
      }
    } catch (err: any) {
      setError(err?.message || 'Request failed — check API keys in Vercel environment variables')
    } finally {
      setLoading(false)
    }
  }

  async function addPrompt(suggestion: Suggestion, index: number) {
    if (!activeClient) return

    await supabase.from('prompts').insert({
      client_id: activeClient.id,
      text: suggestion.text,
      category: suggestion.category,
    })

    setAddedIds((prev) => new Set(prev).add(index))
    onAdded()
  }

  async function addAllPrompts() {
    if (!activeClient) return
    setAddingAll(true)

    const toAdd = suggestions
      .map((s, i) => ({ ...s, index: i }))
      .filter((s) => !addedIds.has(s.index))

    const rows = toAdd.map((s) => ({
      client_id: activeClient.id,
      text: s.text,
      category: s.category,
    }))

    if (rows.length > 0) {
      await supabase.from('prompts').insert(rows)
      setAddedIds(new Set(suggestions.map((_, i) => i)))
      onAdded()
    }

    setAddingAll(false)
  }

  // Not yet generated
  if (suggestions.length === 0 && !loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">AI-Suggested Prompts</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Let Claude analyze your client&apos;s industry and suggest the most important prompts to track.
            </p>
          </div>
          <button
            onClick={generateSuggestions}
            disabled={!activeClient}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            Generate Suggestions
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Analyzing industry and generating prompt suggestions...
        </div>
      </div>
    )
  }

  // Show suggestions
  const remainingCount = suggestions.filter((_, i) => !addedIds.has(i)).length

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            AI-Suggested Prompts
            <span className="text-xs font-normal text-gray-400 ml-2">({suggestions.length} suggestions)</span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {remainingCount > 0 && (
            <button
              onClick={addAllPrompts}
              disabled={addingAll}
              className="px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              {addingAll ? 'Adding...' : `Add all ${remainingCount}`}
            </button>
          )}
          <button
            onClick={generateSuggestions}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Regenerate
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
        {suggestions.map((suggestion, i) => {
          const cat = categoryLabels[suggestion.category] || categoryLabels.awareness
          const isAdded = addedIds.has(i)

          return (
            <div key={i} className={`px-5 py-3 flex items-start gap-3 ${isAdded ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{suggestion.text}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${cat.bg} ${cat.text}`}>
                    {cat.label}
                  </span>
                  <span className="text-xs text-gray-400">{suggestion.reasoning}</span>
                </div>
              </div>
              <button
                onClick={() => addPrompt(suggestion, i)}
                disabled={isAdded}
                className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isAdded
                    ? 'bg-green-50 text-green-600 cursor-default'
                    : 'bg-brand-bg text-brand hover:bg-brand hover:text-white'
                }`}
              >
                {isAdded ? 'Added' : 'Add'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
