'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface Review {
  id: string
  platform: string
  rating: number
  review_text: string
  author: string
  sentiment: string
}

export default function ReviewIntelligence() {
  const { activeClient } = useClient()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState('all')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      if (!activeClient) { setReviews([]); setLoading(false); return }
      setLoading(true)
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('reviewed_at', { ascending: false })
        .limit(50)
      setReviews(data || [])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient])

  async function handleSync() {
    if (!activeClient) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/reviews/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id }),
      })
      const data = await res.json()
      setSyncMsg(res.ok ? `Synced ${data.synced} reviews` : data.error)
      if (res.ok) {
        const { data: updated } = await supabase.from('reviews').select('*').eq('client_id', activeClient.id).order('reviewed_at', { ascending: false }).limit(50)
        setReviews(updated || [])
      }
    } catch { setSyncMsg('Sync failed') }
    setSyncing(false)
  }

  const filtered = platformFilter === 'all' ? reviews : reviews.filter((r) => r.platform === platformFilter)
  const platforms = [...new Set(reviews.map((r) => r.platform))]
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—'
  const positive = reviews.filter((r) => r.sentiment === 'positive').length
  const negative = reviews.filter((r) => r.sentiment === 'negative').length

  if (!activeClient) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-[2.5px] h-4 bg-brand rounded-full" />
            Review Intelligence
          </h3>
          {reviews.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {reviews.length} reviews · {avgRating} avg · {positive} positive · {negative} negative
            </p>
          )}
        </div>
        <button onClick={handleSync} disabled={syncing}
          className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
          {syncing ? 'Syncing...' : 'Sync Reviews'}
        </button>
      </div>

      {syncMsg && (
        <div className={`px-5 py-2 text-xs font-medium border-b ${syncMsg.includes('fail') || syncMsg.includes('error') ? 'bg-red-50 text-red-700' : 'bg-brand-bg text-brand'}`}>
          {syncMsg}
        </div>
      )}

      {platforms.length > 1 && (
        <div className="px-5 py-2 border-b border-gray-100 flex gap-2">
          <button onClick={() => setPlatformFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-full ${platformFilter === 'all' ? 'bg-brand-bg text-brand' : 'bg-gray-100 text-gray-600'}`}>All</button>
          {platforms.map((p) => (
            <button key={p} onClick={() => setPlatformFilter(p)}
              className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${platformFilter === p ? 'bg-brand-bg text-brand' : 'bg-gray-100 text-gray-600'}`}>{p}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center"><p className="text-sm text-gray-400">Loading reviews...</p></div>
      ) : reviews.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">No reviews synced yet. Click &quot;Sync Reviews&quot; to fetch from connected platforms.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {filtered.slice(0, 20).map((r) => (
            <div key={r.id} className="px-5 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-400 capitalize">{r.platform}</span>
                <span className="text-amber-400">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${r.sentiment === 'positive' ? 'bg-green-50 text-green-700' : r.sentiment === 'negative' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{r.sentiment}</span>
              </div>
              <p className="text-sm text-gray-700 line-clamp-2">{r.review_text}</p>
              <p className="text-xs text-gray-400 mt-1">— {r.author}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
