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
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-sm text-gray-500">No competitors added yet. Add one above to start tracking.</p>
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
