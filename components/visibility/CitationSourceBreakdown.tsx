'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import { buildCitationHitList } from '@/lib/analytics/citationSources'

interface SourceData {
  source: string
  type: string
  count: number
  percentage: number
}

const typeColors: Record<string, string> = {
  own_website: 'bg-brand',
  review_site: 'bg-amber-500',
  press: 'bg-blue-500',
  social: 'bg-pink-500',
  directory: 'bg-green-500',
  academic: 'bg-purple-500',
  unknown: 'bg-gray-400',
}

export default function CitationSourceBreakdown() {
  const { activeClient } = useClient()
  const [sources, setSources] = useState<SourceData[]>([])
  const [hitList, setHitList] = useState<{ platform: string; competitors_on_it: string[]; priority: string; action: string }[]>([])
  const [recommendation, setRecommendation] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      if (!activeClient) { setSources([]); setLoading(false); return }
      setLoading(true)

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: scans } = await supabase
        .from('scan_results')
        .select('citation_sources, citation_source_types')
        .eq('client_id', activeClient.id)
        .eq('mentioned', true)
        .gte('scanned_at', thirtyDaysAgo.toISOString())

      const sourceCounts = new Map<string, { type: string; count: number }>()
      for (const r of scans || []) {
        const srcs = r.citation_sources || []
        const types = r.citation_source_types || []
        for (let i = 0; i < srcs.length; i++) {
          const existing = sourceCounts.get(srcs[i])
          if (existing) existing.count++
          else sourceCounts.set(srcs[i], { type: types[i] || 'unknown', count: 1 })
        }
      }

      const total = Array.from(sourceCounts.values()).reduce((s, v) => s + v.count, 0)
      const sorted = Array.from(sourceCounts.entries())
        .map(([source, data]) => ({
          source, type: data.type, count: data.count,
          percentage: total > 0 ? Math.round((data.count / total) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)

      setSources(sorted)

      // Generate recommendation
      const typeBreakdown = new Map<string, number>()
      for (const s of sorted) typeBreakdown.set(s.type, (typeBreakdown.get(s.type) || 0) + s.count)

      const ownWebsite = typeBreakdown.get('own_website') || 0
      const reviewSite = typeBreakdown.get('review_site') || 0

      if (total === 0) setRecommendation('No citation sources detected yet. Publish structured FAQ content and get listed on review platforms.')
      else if (ownWebsite > total * 0.7) setRecommendation('Citations come almost entirely from your website. Diversify with G2/Capterra reviews and press mentions.')
      else if (reviewSite === 0) setRecommendation('Zero review site citations. Getting 20+ reviews on G2 or Google could significantly increase AI authority.')
      else setRecommendation('Good citation diversity. Focus on increasing volume across your strongest sources.')

      // Build cross-competitor hit list using library function
      const hits = await buildCitationHitList(supabase, activeClient!.id)
      setHitList(hits.map((h) => ({
        platform: h.platform,
        competitors_on_it: h.competitors_on_it,
        priority: h.priority,
        action: h.action,
      })))

      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient])

  if (loading || sources.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className="w-[2.5px] h-4 bg-brand rounded-full" />
        Citation Sources
      </h3>

      {/* Stacked bar */}
      <div className="w-full h-6 bg-gray-100 rounded-lg overflow-hidden flex mb-4">
        {sources.slice(0, 8).map((s) => (
          <div key={s.source} className={`h-full ${typeColors[s.type] || 'bg-gray-400'}`}
            style={{ width: `${s.percentage}%` }} title={`${s.source}: ${s.percentage}%`} />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-1.5">
        {sources.slice(0, 8).map((s) => (
          <div key={s.source} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-sm ${typeColors[s.type] || 'bg-gray-400'}`} />
              <span className="text-xs text-gray-700">{s.source}</span>
              <span className="text-[10px] text-gray-400 capitalize">{s.type.replace('_', ' ')}</span>
            </div>
            <span className="text-xs font-semibold text-gray-900">{s.percentage}%</span>
          </div>
        ))}
      </div>

      {recommendation && (
        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">{recommendation}</p>
      )}

      {hitList.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Competitors are cited here — you're not</p>
          <div className="space-y-2">
            {hitList.map((h, i) => (
              <div key={i} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{h.platform}</p>
                  <p className="text-[10px] text-gray-500">{h.competitors_on_it.join(', ')} cited here</p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${h.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {h.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
