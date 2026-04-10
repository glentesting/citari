'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface Threat {
  threat: string
  competitor: string
  evidence: string
  urgency: 'high' | 'medium' | 'low'
  recommendedAction: string
}

interface DriftEvent {
  model: string
  description: string
  affectedPromptCount: number
  isModelUpdate: boolean
  recommendation: string
}

export default function PredictiveAlerts() {
  const { activeClient } = useClient()
  const [threats, setThreats] = useState<Threat[]>([])
  const [drifts, setDrifts] = useState<DriftEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!activeClient) { setThreats([]); setDrifts([]); setLoading(false); return }
      setLoading(true)

      // Import and run client-side (these only read from supabase)
      try {
        const supabase = createClient()

        // Predictive threats — check competitor content from last 7 days
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

        const { data: competitors } = await supabase
          .from('competitors')
          .select('id, name')
          .eq('client_id', activeClient.id)

        const { data: prompts } = await supabase
          .from('prompts')
          .select('text')
          .eq('client_id', activeClient.id)
          .eq('is_active', true)

        const foundThreats: Threat[] = []

        for (const comp of competitors || []) {
          const { data: recentContent } = await supabase
            .from('competitor_content')
            .select('title')
            .eq('competitor_id', comp.id)
            .gte('crawled_at', oneWeekAgo.toISOString())

          if (!recentContent || recentContent.length < 2) continue

          let matchCount = 0
          for (const content of recentContent) {
            const titleLower = (content.title || '').toLowerCase()
            for (const prompt of prompts || []) {
              const words = prompt.text.toLowerCase().split(' ').filter((w: string) => w.length > 4)
              if (words.filter((w: string) => titleLower.includes(w)).length >= 2) {
                matchCount++
                break
              }
            }
          }

          if (matchCount >= 2) {
            foundThreats.push({
              threat: `${comp.name} published ${recentContent.length} pieces targeting your prompts`,
              competitor: comp.name,
              evidence: `${matchCount} pieces match tracked prompts`,
              urgency: matchCount >= 4 ? 'high' : 'medium',
              recommendedAction: 'Create counter-content targeting the same prompts.',
            })
          }
        }
        setThreats(foundThreats)

        // Drift detection — compare last 2 weeks
        const twoWeeksAgo = new Date()
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

        const { data: thisWeek } = await supabase
          .from('scan_results')
          .select('model, prompt_id, mentioned')
          .eq('client_id', activeClient.id)
          .gte('scanned_at', oneWeekAgo.toISOString())

        const { data: lastWeek } = await supabase
          .from('scan_results')
          .select('model, prompt_id, mentioned')
          .eq('client_id', activeClient.id)
          .gte('scanned_at', twoWeeksAgo.toISOString())
          .lt('scanned_at', oneWeekAgo.toISOString())

        const foundDrifts: DriftEvent[] = []
        const models = ['chatgpt', 'claude', 'gemini'] as const

        for (const model of models) {
          const cur = (thisWeek || []).filter((r) => r.model === model)
          const prev = (lastWeek || []).filter((r) => r.model === model)
          if (cur.length === 0 || prev.length === 0) continue

          const allPids = [...new Set([...cur.map((r) => r.prompt_id), ...prev.map((r) => r.prompt_id)])]
          let changed = 0
          for (const pid of allPids) {
            const c = cur.find((r) => r.prompt_id === pid)?.mentioned
            const p = prev.find((r) => r.prompt_id === pid)?.mentioned
            if (c !== undefined && p !== undefined && c !== p) changed++
          }

          if (changed >= 3) {
            const modelName = model === 'chatgpt' ? 'ChatGPT' : model === 'claude' ? 'Claude' : 'Gemini'
            const isModelUpdate = changed >= Math.floor(allPids.length * 0.5)
            foundDrifts.push({
              model: modelName,
              description: `${modelName} changed on ${changed} prompts`,
              affectedPromptCount: changed,
              isModelUpdate,
              recommendation: isModelUpdate
                ? 'Likely a model update — wait 2 weeks to reassess.'
                : 'May be competitor-driven — check competitor activity.',
            })
          }
        }
        setDrifts(foundDrifts)
      } catch (e) { console.error('Failed to load predictive alerts:', e) }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient])

  if (loading || (threats.length === 0 && drifts.length === 0)) return null

  return (
    <div className="space-y-3">
      {threats.map((t, i) => (
        <div key={`t-${i}`} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
          t.urgency === 'high' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <span className="text-lg mt-0.5">{t.urgency === 'high' ? '🚨' : '⚠️'}</span>
          <div>
            <p className={`text-sm font-medium ${t.urgency === 'high' ? 'text-red-800' : 'text-amber-800'}`}>
              Predictive Threat: {t.threat}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">{t.evidence}</p>
            <p className="text-xs text-gray-500 mt-1">{t.recommendedAction}</p>
          </div>
        </div>
      ))}

      {drifts.map((d, i) => (
        <div key={`d-${i}`} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
          <span className="text-lg mt-0.5">🔄</span>
          <div>
            <p className="text-sm font-medium text-blue-800">
              Model Behavior Change: {d.model}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {d.description}. {d.isModelUpdate ? 'Appears to be a model update.' : 'May be competitor-driven.'}
            </p>
            <p className="text-xs text-gray-500 mt-1">{d.recommendation}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
