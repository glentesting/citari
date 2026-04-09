'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdItem {
  id: string
  platform: 'google' | 'meta'
  ad_text: string
  ad_url: string
  first_seen: string
  last_seen: string
  is_active: boolean
}

interface AdIntelligenceProps {
  competitorId: string
  competitorName: string
  competitorDomain: string | null
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return Math.max(1, Math.round(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)))
}

export default function AdIntelligence({
  competitorId,
  competitorName,
  competitorDomain,
}: AdIntelligenceProps) {
  const [ads, setAds] = useState<AdItem[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchMessage, setFetchMessage] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState<'all' | 'google' | 'meta'>('all')
  const supabase = createClient()

  async function loadAds() {
    setLoading(true)
    const { data } = await supabase
      .from('competitor_ads')
      .select('*')
      .eq('competitor_id', competitorId)
      .order('first_seen', { ascending: false })

    setAds(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadAds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitorId])

  async function fetchAds() {
    setFetching(true)
    setFetchMessage(null)

    try {
      const res = await fetch('/api/competitors/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_id: competitorId }),
      })

      const data = await res.json()
      if (!res.ok) {
        setFetchMessage(`Failed: ${data.error}`)
      } else {
        setFetchMessage(`Found ${data.google_ads} Google ads and ${data.meta_ads} Meta ads`)
        await loadAds()
      }
    } catch {
      setFetchMessage('Network error')
    } finally {
      setFetching(false)
    }
  }

  const filtered = platformFilter === 'all'
    ? ads
    : ads.filter((a) => a.platform === platformFilter)

  const googleCount = ads.filter((a) => a.platform === 'google').length
  const metaCount = ads.filter((a) => a.platform === 'meta').length

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{competitorName} Ads</h4>
          {ads.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {googleCount} Google · {metaCount} Meta
            </p>
          )}
        </div>
        <button
          onClick={fetchAds}
          disabled={fetching}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
        >
          {fetching ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Fetching...
            </>
          ) : ads.length > 0 ? 'Refresh Ads' : 'Fetch Ads'}
        </button>
      </div>

      {fetchMessage && (
        <div className={`px-5 py-2 text-xs font-medium border-b ${
          fetchMessage.includes('Failed')
            ? 'bg-red-50 border-red-100 text-red-700'
            : 'bg-brand-bg border-brand-border text-brand'
        }`}>
          {fetchMessage}
        </div>
      )}

      {/* Platform filter */}
      {ads.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
          {(['all', 'google', 'meta'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPlatformFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                platformFilter === f
                  ? 'bg-brand-bg text-brand'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'google' ? 'Google' : 'Meta'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-400">Loading ads...</p>
        </div>
      ) : ads.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">
            No ads found yet. Click &quot;Fetch Ads&quot; to scan Google and Meta ad libraries.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {filtered.map((ad) => {
            const runDays = daysBetween(ad.first_seen, ad.last_seen)
            return (
              <div key={ad.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        ad.platform === 'google'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {ad.platform === 'google' ? 'Google' : 'Meta'}
                      </span>
                      {runDays >= 30 && (
                        <span className="text-[10px] font-medium text-amber-600">
                          Running {runDays} days — proven ad
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 line-clamp-3">{ad.ad_text}</p>
                  </div>
                  {ad.ad_url && (
                    <a
                      href={ad.ad_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-gray-400 hover:text-brand transition-colors mt-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
