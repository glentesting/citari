'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Pattern {
  promptText: string
  peakLabel: string
  weeksUntilPeak: number | null
  recommendation: string | null
}

export default function SeasonalityView() {
  const { activeClient } = useClient()
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      if (!activeClient) { setPatterns([]); setLoading(false); return }
      setLoading(true)

      // Fetch prompts + scan data to detect seasonality client-side
      const { data: prompts } = await supabase
        .from('prompts')
        .select('id, text')
        .eq('client_id', activeClient.id)
        .eq('is_active', true)

      const { data: scans } = await supabase
        .from('scan_results')
        .select('prompt_id, competitor_mentions, scanned_at')
        .eq('client_id', activeClient.id)

      if (!prompts || !scans || scans.length < 20) { setPatterns([]); setLoading(false); return }

      const currentMonth = new Date().getMonth() + 1
      const found: Pattern[] = []

      for (const prompt of prompts) {
        const promptScans = scans.filter((s) => s.prompt_id === prompt.id)
        if (promptScans.length < 10) continue

        const monthlyComp: Record<number, number[]> = {}
        for (const scan of promptScans) {
          const month = new Date(scan.scanned_at).getMonth() + 1
          if (!monthlyComp[month]) monthlyComp[month] = []
          monthlyComp[month].push(scan.competitor_mentions?.length || 0)
        }

        if (Object.keys(monthlyComp).length < 2) continue

        let peakMonth = 1, peakVal = 0
        for (const [m, vals] of Object.entries(monthlyComp)) {
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length
          if (avg > peakVal) { peakVal = avg; peakMonth = parseInt(m) }
        }

        const monthsUntil = peakMonth > currentMonth ? peakMonth - currentMonth : 12 - currentMonth + peakMonth
        const weeksUntilPeak = peakMonth === currentMonth ? null : monthsUntil * 4

        if (weeksUntilPeak !== null && weeksUntilPeak <= 8 && weeksUntilPeak > 0) {
          found.push({
            promptText: prompt.text,
            peakLabel: MONTHS[peakMonth - 1],
            weeksUntilPeak,
            recommendation: `Peak competition in ${MONTHS[peakMonth - 1]} — start building content now (~${weeksUntilPeak} weeks).`,
          })
        }
      }

      setPatterns(found.sort((a, b) => (a.weeksUntilPeak ?? 99) - (b.weeksUntilPeak ?? 99)))
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient])

  if (loading || patterns.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
        <span className="text-base">📅</span>
        Seasonal Alerts
      </h3>
      <div className="space-y-2">
        {patterns.map((p, i) => (
          <div key={i} className="bg-white/70 rounded-lg px-3 py-2">
            <p className="text-sm text-gray-900 line-clamp-1">{p.promptText}</p>
            <p className="text-xs text-amber-700 mt-0.5">{p.recommendation}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
