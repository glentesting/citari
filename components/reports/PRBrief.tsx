'use client'

import { useState, useEffect } from 'react'
import { useClient } from '@/hooks/useClient'
import { runBackgroundJob, onJobUpdate } from '@/lib/jobs'

export default function PRBrief() {
  const { activeClient } = useClient()
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onJobUpdate((job) => {
      if (job.id === `pr-brief-${activeClient?.id}`) {
        if (job.status === 'done') {
          setLoading(false)
          setResult({ summary: 'PR Brief generated — refresh to view full results.' })
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
    setResult(null)
    runBackgroundJob(
      `pr-brief-${activeClient.id}`,
      'Generating PR brief',
      '/api/generate-pr-brief',
      { client_id: activeClient.id }
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">PR Brief Generator</h3>
          <p className="text-xs text-gray-500 mt-0.5">Generate press release drafts and media pitch templates.</p>
        </div>
        <button onClick={generate} disabled={loading || !activeClient}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50">
          {loading ? 'Generating...' : 'Generate PR Brief'}
        </button>
      </div>

      {error && <div className="px-5 py-2 bg-red-50 border-b text-xs text-red-600">{error}</div>}

      {result && (
        <div className="p-5 space-y-4">
          {result.summary && (
            <div>
              <h4 className="text-xs font-semibold text-gray-900 mb-1">Summary</h4>
              <p className="text-sm text-gray-700">{result.summary}</p>
            </div>
          )}

          {result.target_publications && result.target_publications.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-900 mb-2">Target Publications</h4>
              <div className="space-y-2">
                {result.target_publications.map((p: any, i: number) => (
                  <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{p.why}</p>
                    <p className="text-xs text-brand mt-0.5">Pitch: {p.pitch_angle}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.press_release_draft && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold text-gray-900">Press Release Draft</h4>
                <button onClick={() => navigator.clipboard.writeText(result.press_release_draft)} className="text-[10px] text-brand hover:underline">Copy</button>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">{result.press_release_draft}</div>
            </div>
          )}

          {result.pitch_email && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold text-gray-900">Pitch Email Template</h4>
                <button onClick={() => navigator.clipboard.writeText(result.pitch_email)} className="text-[10px] text-brand hover:underline">Copy</button>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">{result.pitch_email}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
