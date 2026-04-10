'use client'

import { useState } from 'react'
import { useClient } from '@/hooks/useClient'

interface AuditResult {
  prompt_id: string | null
  prompt_text: string
  score: number
  found_on_page: string | null
  whats_missing: string
  fix: string
}

export default function GEOAudit() {
  const { activeClient } = useClient()
  const [audits, setAudits] = useState<AuditResult[]>([])
  const [avgScore, setAvgScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAudit() {
    if (!activeClient) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/clients/geo-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setAudits(data.audits || [])
        setAvgScore(data.avg_score)
      } else {
        setError(data.error || 'Audit failed')
      }
    } catch (e) {
      console.error('GEO audit failed:', e)
      setError('Network error')
    }
    setLoading(false)
  }

  if (!activeClient) return null

  const scoreColor = (s: number) =>
    s >= 8 ? 'text-green-600 bg-green-50' :
    s >= 5 ? 'text-amber-600 bg-amber-50' :
    'text-red-600 bg-red-50'

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-[2.5px] h-4 bg-brand rounded-full" />
            GEO Website Audit
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Does your website answer the questions AI models are being asked about your industry?
          </p>
          {avgScore !== null && (
            <p className="text-xs text-gray-500 mt-0.5">
              GEO Readiness: <span className={`font-semibold ${avgScore >= 70 ? 'text-green-600' : avgScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{avgScore}%</span>
            </p>
          )}
        </div>
        <button onClick={handleAudit} disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 flex items-center gap-1.5">
          {loading ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Auditing...
            </>
          ) : audits.length > 0 ? 'Re-audit' : 'Run GEO Audit'}
        </button>
      </div>

      {error && (
        <div className="px-5 py-2 text-xs font-medium border-b bg-red-50 text-red-700">{error}</div>
      )}

      {audits.length === 0 && !loading ? (
        <div className="p-6 text-center">
          <p className="text-sm text-gray-500">
            Click &quot;Run GEO Audit&quot; to check if your website answers the questions AI models are being asked.
          </p>
        </div>
      ) : loading ? (
        <div className="p-6 text-center">
          <p className="text-sm text-gray-400 animate-pulse">Crawling your website and auditing against tracked prompts...</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {audits.sort((a, b) => a.score - b.score).map((audit, i) => (
            <div key={i} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{audit.prompt_text}</p>
                  {audit.found_on_page && (
                    <a href={audit.found_on_page} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-brand hover:underline">{audit.found_on_page}</a>
                  )}
                </div>
                <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-bold rounded-full ${scoreColor(audit.score)}`}>
                  {audit.score}/10
                </span>
              </div>
              {audit.score < 7 && (
                <div className="mt-2 bg-gray-50 rounded-lg p-2.5 space-y-1">
                  {audit.whats_missing && (
                    <p className="text-xs text-red-700"><span className="font-semibold">Missing:</span> {audit.whats_missing}</p>
                  )}
                  {audit.fix && (
                    <p className="text-xs text-brand"><span className="font-semibold">Fix:</span> {audit.fix}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
