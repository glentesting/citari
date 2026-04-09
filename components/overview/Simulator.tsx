'use client'

import { useState } from 'react'
import { useClient } from '@/hooks/useClient'

interface SimAction {
  step: number
  action: string
  detail: string
  estimated_impact: string
  estimated_weeks: number
  content_topics?: string[]
}

interface SimResult {
  currentScore: number
  targetScore: number
  summary: string
  estimated_weeks: number
  actions: SimAction[]
}

interface SimulatorProps {
  currentScore: number
}

export default function Simulator({ currentScore }: SimulatorProps) {
  const { activeClient } = useClient()
  const [targetScore, setTargetScore] = useState(Math.min(currentScore + 20, 100))
  const [result, setResult] = useState<SimResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runSimulation() {
    if (!activeClient) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: activeClient.id,
          target_score: targetScore,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Simulation failed')
      } else {
        setResult(data)
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-[2.5px] h-4 bg-brand rounded-full" />
          &quot;What Would It Take?&quot; Simulator
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Set a visibility goal and get a specific AI-generated roadmap to reach it.
        </p>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Target Visibility Score</label>
              <span className="text-sm font-bold text-brand">{targetScore}%</span>
            </div>
            <input
              type="range"
              min={Math.min(currentScore + 5, 100)}
              max={100}
              value={targetScore}
              onChange={(e) => setTargetScore(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-brand"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">Current: {currentScore}%</span>
              <span className="text-xs text-gray-400">Gap: +{targetScore - currentScore}%</span>
            </div>
          </div>
          <button
            onClick={runSimulation}
            disabled={loading || !activeClient}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Simulating...
              </>
            ) : (
              'Run Simulation'
            )}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      {result && (
        <div className="border-t border-gray-200">
          {/* Summary bar */}
          <div className="px-5 py-4 bg-brand-bg border-b border-brand-border">
            <p className="text-sm font-medium text-brand">{result.summary}</p>
            <p className="text-xs text-gray-600 mt-1">
              Estimated timeline: <span className="font-semibold">{result.estimated_weeks} weeks</span>
            </p>
          </div>

          {/* Action steps */}
          <div className="divide-y divide-gray-100">
            {result.actions.map((action) => (
              <div key={action.step} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-brand text-white text-xs font-bold mt-0.5">
                    {action.step}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">{action.action}</h4>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className="text-xs font-semibold text-green-600">{action.estimated_impact}</span>
                        <span className="text-xs text-gray-400">{action.estimated_weeks}w</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{action.detail}</p>
                    {action.content_topics && action.content_topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {action.content_topics.map((topic, i) => (
                          <span key={i} className="inline-flex px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
