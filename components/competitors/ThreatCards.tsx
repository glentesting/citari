'use client'

import { createClient } from '@/lib/supabase/client'

export interface CompetitorThreat {
  id: string
  name: string
  domain: string | null
  mentionRate: number
  clientMentionRate: number
  promptsWinning: number
  totalPrompts: number
  threatLevel: 'high' | 'medium' | 'low'
  velocity?: { delta: number; direction: 'up' | 'down' | 'flat' }
}

interface ThreatCardsProps {
  competitors: CompetitorThreat[]
  onDeleted: () => void
}

const threatConfig = {
  high: { border: 'border-l-red-500', bg: 'bg-red-50', text: 'text-red-700', label: 'High Threat' },
  medium: { border: 'border-l-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', label: 'Medium Threat' },
  low: { border: 'border-l-green-500', bg: 'bg-green-50', text: 'text-green-700', label: 'Low Threat' },
}

export default function ThreatCards({ competitors, onDeleted }: ThreatCardsProps) {
  const supabase = createClient()

  async function deleteCompetitor(id: string) {
    await supabase.from('competitors').delete().eq('id', id)
    onDeleted()
  }

  if (competitors.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <div className="w-12 h-12 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No competitors tracked yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Add competitors to see threat assessments, head-to-head prompt comparisons, and share of voice analysis.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {competitors.map((comp) => {
        const config = threatConfig[comp.threatLevel]
        return (
          <div
            key={comp.id}
            className={`bg-white border border-gray-200 border-l-4 ${config.border} rounded-xl p-5 relative group`}
          >
            {/* Delete button */}
            <button
              onClick={() => deleteCompetitor(comp.id)}
              className="absolute top-3 right-3 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              title="Remove competitor"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Threat badge */}
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text} mb-3`}>
              {config.label}
            </span>

            <h4 className="text-base font-semibold text-gray-900">{comp.name}</h4>
            {comp.domain && (
              <p className="text-xs text-gray-400 mt-0.5">{comp.domain}</p>
            )}

            <div className="mt-4 space-y-3">
              {/* Mention rate comparison */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Their mention rate</span>
                  <span className="font-semibold text-gray-900">{comp.mentionRate}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full"
                    style={{ width: `${comp.mentionRate}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Your mention rate</span>
                  <span className="font-semibold text-gray-900">{comp.clientMentionRate}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full"
                    style={{ width: `${comp.clientMentionRate}%` }}
                  />
                </div>
              </div>

              {/* Velocity */}
              {comp.velocity && comp.velocity.direction !== 'flat' && (
                <p className={`text-xs font-medium ${comp.velocity.direction === 'up' ? 'text-red-600' : 'text-green-600'}`}>
                  {comp.velocity.direction === 'up' ? '↑' : '↓'} {Math.abs(comp.velocity.delta)}% this week
                </p>
              )}

              {/* Prompts winning */}
              <p className="text-xs text-gray-500">
                Winning on <span className="font-semibold text-gray-900">{comp.promptsWinning}</span> of {comp.totalPrompts} prompts
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
