'use client'

import { useState } from 'react'
import { useClient } from '@/hooks/useClient'

interface CompetitiveBriefProps {
  competitorId: string
  competitorName: string
}

export default function CompetitiveBrief({ competitorId, competitorName }: CompetitiveBriefProps) {
  const { activeClient } = useClient()
  const [brief, setBrief] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    if (!activeClient) return
    setLoading(true)
    setError(null)
    setBrief(null)

    try {
      const res = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_id: competitorId, client_id: activeClient.id }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error)
      else setBrief(data.brief)
    } catch { setError('Network error') }
    setLoading(false)
  }

  return (
    <div>
      {!brief && !loading && (
        <button onClick={generate} disabled={loading}
          className="text-xs text-brand font-medium hover:underline">
          Generate Brief
        </button>
      )}

      {loading && <p className="text-xs text-gray-400 animate-pulse">Analyzing competitor intelligence...</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {brief && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-900">Competitive Brief: {competitorName}</h4>
            <button onClick={() => navigator.clipboard.writeText(brief)} className="text-[10px] text-brand hover:underline">Copy</button>
          </div>
          <div className="text-xs text-gray-700 leading-relaxed space-y-2">
            {brief.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-gray-900 mt-2">{line.replace('## ', '')}</h3>
              if (line.trim() === '') return <br key={i} />
              return <p key={i}>{line}</p>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
