'use client'

import { useState, useEffect } from 'react'
import { useClient } from '@/hooks/useClient'
import { runBackgroundJob, onJobUpdate } from '@/lib/jobs'

interface NarrativeGeneratorProps {
  onGenerated?: (narrative: string) => void
}

export default function NarrativeGenerator({ onGenerated }: NarrativeGeneratorProps) {
  const { activeClient } = useClient()
  const [narrative, setNarrative] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onJobUpdate((job) => {
      if (job.id === `narrative-${activeClient?.id}`) {
        if (job.status === 'done') {
          setLoading(false)
          // Re-fetch the narrative from the reports table
          setNarrative('Narrative generated — switch to the Reports tab to view it.')
        } else if (job.status === 'error') {
          setLoading(false)
          setError(job.error || 'Generation failed')
        }
      }
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient])

  function generate() {
    if (!activeClient) return
    setLoading(true)
    setError(null)
    runBackgroundJob(
      `narrative-${activeClient.id}`,
      'Generating narrative',
      '/api/generate-narrative',
      { client_id: activeClient.id }
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">AI Executive Narrative</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Claude writes a consultant-quality monthly intelligence briefing from your scan data.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading || !activeClient}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Writing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              Generate Narrative
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="px-5 py-3 bg-red-50 border-b border-red-100">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {narrative && (
        <div className="p-5">
          <div className="flex items-center justify-end mb-3">
            <button
              onClick={() => navigator.clipboard.writeText(narrative)}
              className="text-xs text-brand font-medium hover:underline"
            >
              Copy to clipboard
            </button>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 prose prose-sm max-w-none text-gray-700">
            {narrative.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return <h3 key={i} className="text-base font-semibold text-gray-900 mt-4 mb-2 first:mt-0">{line.replace('## ', '')}</h3>
              }
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-semibold text-gray-900 mt-2">{line.replace(/\*\*/g, '')}</p>
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return <li key={i} className="ml-4 text-sm leading-relaxed">{line.replace(/^[-*]\s/, '')}</li>
              }
              if (line.trim() === '') return <br key={i} />
              return <p key={i} className="text-sm leading-relaxed">{line}</p>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
