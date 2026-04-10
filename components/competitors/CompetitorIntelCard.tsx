'use client'

import { useState, useEffect } from 'react'
import type { Competitor } from '@/types'

const threatColors = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600', bar: 'bg-gray-400' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', bar: 'bg-yellow-400' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500' },
}

interface CompetitorIntelCardProps {
  competitor: Competitor
  clientName: string
  onDeleted: () => void
  onRefreshed: () => void
}

export default function CompetitorIntelCard({ competitor, clientName, onDeleted, onRefreshed }: CompetitorIntelCardProps) {
  const [tab, setTab] = useState<'brief' | 'gaps' | 'compare'>('brief')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [quickWins, setQuickWins] = useState<string[]>([])
  const [checkedWins, setCheckedWins] = useState<Set<number>>(new Set())

  const hasIntel = !!competitor.intel_brief

  // Parse quick_wins from intel_brief if present — they're embedded in the content_gaps or we fetch separately
  // For now, parse bullet points from content_gaps as actionable items

  // Load checked state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`quickwins_${competitor.id}`)
    if (stored) {
      try { setCheckedWins(new Set(JSON.parse(stored))) } catch { /* */ }
    }
  }, [competitor.id])

  function toggleWin(idx: number) {
    setCheckedWins((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      localStorage.setItem(`quickwins_${competitor.id}`, JSON.stringify([...next]))
      return next
    })
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await fetch('/api/competitors/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_id: competitor.id }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.quick_wins) setQuickWins(data.quick_wins)
        onRefreshed()
      } else {
        const data = await res.json().catch(() => ({}))
        setAnalyzeError(data.error || 'Analysis failed')
      }
    } catch (e) {
      console.error('Intel analysis failed:', e)
      setAnalyzeError('Network error — please try again')
    }
    setAnalyzing(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${competitor.name} and all their data? This cannot be undone.`)) return
    try {
      const res = await fetch('/api/competitors/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_id: competitor.id }),
      })
      if (res.ok) onDeleted()
    } catch (e) {
      console.error('Failed to delete competitor:', e)
    }
  }

  // Determine threat level from visibility score
  const score = competitor.visibility_score || 0
  const threat = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low'
  const colors = threatColors[threat]

  // Parse content gaps into bullets
  const gapBullets = (competitor.content_gaps || '')
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 5)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* 3A: Header card */}
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{competitor.name}</h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${colors.bg} ${colors.text}`}>
                  {threat}
                </span>
              </div>
              {competitor.domain && (
                <p className="text-xs text-gray-400 mt-0.5">{competitor.domain}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!hasIntel && (
              <button onClick={handleAnalyze} disabled={analyzing}
                className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 flex items-center gap-1.5">
                {analyzing ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing...
                  </>
                ) : 'Run Intelligence Analysis'}
              </button>
            )}
            <button onClick={handleDelete}
              className="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="Delete competitor">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </div>

        {analyzeError && <p className="text-xs text-red-600 mb-2">{analyzeError}</p>}

        {/* Visibility score bar */}
        {hasIntel && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">AI Visibility Strength</span>
              <span className="font-semibold text-gray-900">{score}/100</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${score}%` }} />
            </div>
          </div>
        )}

        {/* Why they're winning */}
        {competitor.why_winning && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase text-red-400 mb-2">Why they're winning</p>
            <ul className="space-y-1.5">
              {competitor.why_winning.split(/(?<=[.!])\s+/).filter((s) => s.trim().length > 10).map((sentence, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-900">
                  <span className="text-red-400 mt-1 text-[8px]">&#9679;</span>
                  <span>{sentence.trim()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      {hasIntel && (
        <>
          <div className="px-5 py-2 border-b border-gray-100 flex gap-1 bg-gray-50">
            {(['brief', 'gaps', 'compare'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t === 'brief' ? 'Intel Brief' : t === 'gaps' ? `Content Gaps (${gapBullets.length})` : 'Compare'}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* 3B: Intel Brief tab */}
            {tab === 'brief' && (
              <div className="space-y-4">
                {competitor.intel_brief && (
                  <div className="max-w-none space-y-3">
                    {competitor.intel_brief.split('\n').map((line, i) => {
                      const trimmed = line.trim()
                      if (!trimmed) return null
                      if (trimmed.startsWith('## ')) {
                        return <h3 key={i} className="text-sm font-bold text-gray-900 mt-4 mb-1 flex items-center gap-2">
                          <span className="w-[2.5px] h-4 bg-brand rounded-full" />{trimmed.replace('## ', '')}
                        </h3>
                      }
                      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                        return <div key={i} className="flex items-start gap-2 ml-1">
                          <span className="text-brand mt-1 text-xs">&#9679;</span>
                          <p className="text-sm text-gray-600">{trimmed.replace(/^[-•]\s*/, '')}</p>
                        </div>
                      }
                      if (trimmed.match(/^\d+\.\s/)) {
                        return <div key={i} className="flex items-start gap-2 ml-1">
                          <span className="text-xs font-bold text-brand mt-0.5 w-4">{trimmed.match(/^(\d+)\./)?.[1]}.</span>
                          <p className="text-sm text-gray-600">{trimmed.replace(/^\d+\.\s*/, '')}</p>
                        </div>
                      }
                      return <p key={i} className="text-sm text-gray-600 leading-relaxed">{trimmed}</p>
                    })}
                  </div>
                )}

                {/* Quick wins checklist */}
                {quickWins.length > 0 && (
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-3">Quick Wins — This Week</h4>
                    <div className="space-y-2">
                      {quickWins.map((win, i) => (
                        <label key={i} className="flex items-start gap-2.5 cursor-pointer group">
                          <input type="checkbox" checked={checkedWins.has(i)} onChange={() => toggleWin(i)}
                            className="mt-0.5 rounded border-gray-300 text-brand focus:ring-brand" />
                          <span className={`text-sm ${checkedWins.has(i) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                            {win}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3C: Content Gaps tab */}
            {tab === 'gaps' && (
              <div className="space-y-2">
                {gapBullets.length === 0 ? (
                  <p className="text-sm text-gray-400">No content gaps identified yet.</p>
                ) : (
                  gapBullets.map((gap, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group">
                      <p className="text-sm text-gray-800 flex-1">{gap}</p>
                      <a href={`/geo?prompt=${encodeURIComponent(gap)}`}
                        className="ml-3 px-2.5 py-1 text-[10px] font-semibold text-brand bg-brand-bg rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Generate content
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 3D: Side-by-side comparison */}
            {tab === 'compare' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-green-600 mb-2">{clientName}</h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="text-gray-400 text-xs">Strengths based on your profile</p>
                    {competitor.intel_brief ? (
                      <ul className="space-y-1.5">
                        <li className="flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">+</span>
                          <span>Established brand presence</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">+</span>
                          <span>Your unique positioning</span>
                        </li>
                      </ul>
                    ) : (
                      <p className="text-gray-400">Run analysis to populate</p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase text-red-600 mb-2">{competitor.name}</h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="text-gray-400 text-xs">Strengths from intelligence analysis</p>
                    {competitor.why_winning ? (
                      <ul className="space-y-1.5">
                        {competitor.why_winning.split('.').filter((s) => s.trim().length > 10).slice(0, 4).map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-red-500 mt-0.5">+</span>
                            <span>{s.trim()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400">Run analysis to populate</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 3E: No intel yet */}
      {!hasIntel && !analyzing && (
        <div className="p-6 text-center">
          <p className="text-sm text-gray-500">
            No intelligence analysis yet. Click &quot;Run Intelligence Analysis&quot; to generate a complete competitive brief.
          </p>
        </div>
      )}

      {analyzing && (
        <div className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-brand">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running competitive intelligence analysis...
          </div>
          <p className="text-xs text-gray-400 mt-1">This takes 15-30 seconds</p>
        </div>
      )}
    </div>
  )
}
