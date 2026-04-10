'use client'

import { useState } from 'react'
import { useClient } from '@/hooks/useClient'

export default function PRBrief() {
  const { activeClient } = useClient()
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    if (!activeClient) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/generate-pr-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id }),
        keepalive: true,
      })
      const text = await res.text()
      if (!text) { setError('Server timed out — try again'); setLoading(false); return }
      const data = JSON.parse(text)
      if (!res.ok) setError(data.error || 'Request failed')
      else setResult(data)
    } catch (err: any) { setError(err?.message || 'Request failed — check API keys') }
    setLoading(false)
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
