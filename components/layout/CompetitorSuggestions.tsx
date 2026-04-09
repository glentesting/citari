'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Suggestion {
  name: string
  domain: string | null
  reason: string
}

interface CompetitorSuggestionsProps {
  clientId: string
  clientName: string
  suggestions: Suggestion[]
  onDone: () => void
}

export default function CompetitorSuggestions({
  clientId,
  clientName,
  suggestions,
  onDone,
}: CompetitorSuggestionsProps) {
  const [items, setItems] = useState(
    suggestions.map((s) => ({ ...s, status: 'pending' as 'pending' | 'added' | 'dismissed' }))
  )
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function addCompetitor(index: number) {
    const item = items[index]
    setSaving(true)

    await supabase.from('competitors').insert({
      client_id: clientId,
      name: item.name,
      domain: item.domain || null,
    })

    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, status: 'added' } : it))
    )
    setSaving(false)
  }

  function dismiss(index: number) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, status: 'dismissed' } : it))
    )
  }

  async function addAll() {
    setSaving(true)
    const pending = items.filter((it) => it.status === 'pending')

    if (pending.length > 0) {
      await supabase.from('competitors').insert(
        pending.map((it) => ({
          client_id: clientId,
          name: it.name,
          domain: it.domain || null,
        }))
      )
    }

    setItems((prev) =>
      prev.map((it) => (it.status === 'pending' ? { ...it, status: 'added' } : it))
    )
    setSaving(false)
  }

  const pendingCount = items.filter((it) => it.status === 'pending').length
  const allDone = pendingCount === 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900">Competitors Discovered</h2>
          </div>
          <p className="text-sm text-gray-500">
            We analyzed <strong>{clientName}</strong> and found likely competitors. Add the ones you want to track.
          </p>
        </div>

        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {items.map((item, i) => (
            <div
              key={i}
              className={`px-6 py-3 flex items-start gap-3 ${
                item.status === 'dismissed' ? 'opacity-40' : ''
              } ${item.status === 'added' ? 'bg-green-50/50' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  {item.domain && (
                    <span className="text-xs text-gray-400">{item.domain}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>
              </div>

              {item.status === 'pending' && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => addCompetitor(i)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => dismiss(i)}
                    className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {item.status === 'added' && (
                <span className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg">
                  Added
                </span>
              )}

              {item.status === 'dismissed' && (
                <span className="flex-shrink-0 text-xs text-gray-400">Skipped</span>
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          {!allDone && (
            <button
              onClick={addAll}
              disabled={saving}
              className="text-sm font-medium text-brand hover:underline disabled:opacity-50"
            >
              Add all {pendingCount}
            </button>
          )}
          {allDone && <span />}
          <button
            onClick={onDone}
            className="px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors"
          >
            {allDone ? 'Done' : 'Skip for now'}
          </button>
        </div>
      </div>
    </div>
  )
}
