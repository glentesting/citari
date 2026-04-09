'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import { formatDate } from '@/lib/utils'

interface ScheduledItem {
  id: string
  title: string
  content_type: string
  scheduled_publish_at: string
  cms_platform: string | null
  status: string
  client_name?: string
}

export default function ContentScheduler() {
  const { activeClient } = useClient()
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchScheduled = useCallback(async () => {
    if (!activeClient) { setItems([]); setLoading(false); return }
    setLoading(true)

    const { data } = await supabase
      .from('geo_content')
      .select('id, title, content_type, scheduled_publish_at, cms_platform, status')
      .eq('client_id', activeClient.id)
      .not('scheduled_publish_at', 'is', null)
      .order('scheduled_publish_at', { ascending: true })

    setItems(data || [])
    setLoading(false)
  }, [activeClient])

  useEffect(() => { fetchScheduled() }, [fetchScheduled])

  async function cancelSchedule(id: string) {
    await supabase
      .from('geo_content')
      .update({ scheduled_publish_at: null })
      .eq('id', id)
    fetchScheduled()
  }

  if (loading) return null
  if (items.length === 0) return null

  const upcoming = items.filter((i) => i.status === 'draft')
  const published = items.filter((i) => i.status === 'published')

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-[2.5px] h-4 bg-brand rounded-full" />
          Content Schedule
        </h3>
      </div>

      {upcoming.length > 0 && (
        <div>
          <div className="px-5 py-2 bg-brand-bg border-b border-brand-border">
            <p className="text-xs font-semibold text-brand">Upcoming ({upcoming.length})</p>
          </div>
          {upcoming.map((item) => (
            <div key={item.id} className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">
                    {new Date(item.scheduled_publish_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-400">{item.cms_platform || 'manual'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700">Scheduled</span>
                <button onClick={() => cancelSchedule(item.id)} className="text-xs text-gray-400 hover:text-red-500">Cancel</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {published.length > 0 && (
        <div>
          <div className="px-5 py-2 bg-green-50 border-b border-green-100">
            <p className="text-xs font-semibold text-green-700">Published ({published.length})</p>
          </div>
          {published.slice(0, 5).map((item) => (
            <div key={item.id} className="px-5 py-3 flex items-center justify-between border-b border-gray-100 last:border-b-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                <span className="text-xs text-gray-400">{formatDate(item.scheduled_publish_at)}</span>
              </div>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700">Published</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
