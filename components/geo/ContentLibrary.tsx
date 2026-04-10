'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import type { GeoContent } from '@/types'
import { formatDate } from '@/lib/utils'

interface WPConnection {
  id: string
  site_url: string
}

interface ContentLibraryProps {
  content: GeoContent[]
  onUpdated: () => void
}

function CitationDot({ cited }: { cited: boolean }) {
  return (
    <span
      className={`w-3 h-3 rounded-full ${cited ? 'bg-green-500' : 'bg-gray-200'}`}
      title={cited ? 'Cited' : 'Not cited'}
    />
  )
}

const typeLabels: Record<string, { label: string; bg: string; text: string }> = {
  article: { label: 'Article', bg: 'bg-blue-50', text: 'text-blue-700' },
  comparison: { label: 'Comparison', bg: 'bg-amber-50', text: 'text-amber-700' },
  faq: { label: 'FAQ', bg: 'bg-purple-50', text: 'text-purple-700' },
  landing: { label: 'Landing', bg: 'bg-green-50', text: 'text-green-700' },
}

export default function ContentLibrary({ content, onUpdated }: ContentLibraryProps) {
  const { activeClient } = useClient()
  const supabase = createClient()
  const [editingUrl, setEditingUrl] = useState<string | null>(null)
  const [urlValue, setUrlValue] = useState('')
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [wpConnections, setWpConnections] = useState<WPConnection[]>([])
  const [pushingId, setPushingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadWP() {
      try {
        const { data } = await supabase
          .from('cms_connections')
          .select('id, site_url')
          .eq('platform', 'wordpress')
          .eq('is_active', true)
        setWpConnections(data || [])
      } catch (e) { console.error('Failed to load WordPress connections:', e) }
    }
    loadWP()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function pushToWordPress(contentId: string, connectionId: string) {
    setPushingId(contentId)
    try {
      const res = await fetch('/api/integrations/wordpress/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: contentId, connection_id: connectionId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.post_url) window.open(data.post_url, '_blank')
        onUpdated()
      }
    } catch (e) { console.error('Failed to push to WordPress:', e) }
    setPushingId(null)
  }

  async function handlePublish(id: string) {
    setEditingUrl(id)
    const item = content.find((c) => c.id === id)
    setUrlValue(item?.published_url || '')
  }

  async function savePublishedUrl(id: string) {
    if (!urlValue.trim()) return

    await supabase
      .from('geo_content')
      .update({
        published_url: urlValue.trim(),
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', id)

    // Trigger re-scan of the prompt this content was created for
    const item = content.find((c) => c.id === id)
    if (activeClient && item?.prompt_id) {
      fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: activeClient.id,
          prompt_ids: [item.prompt_id],
        }),
      }).catch((e) => console.error('Re-scan after publish failed:', e))
    }

    setEditingUrl(null)
    setUrlValue('')
    onUpdated()
  }

  async function handleSchedule(id: string) {
    if (!scheduleDate) return
    await fetch('/api/content/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: id, scheduled_publish_at: new Date(scheduleDate).toISOString() }),
    })
    setSchedulingId(null)
    setScheduleDate('')
    onUpdated()
  }

  async function unpublish(id: string) {
    await supabase
      .from('geo_content')
      .update({
        status: 'draft',
        published_url: null,
        published_at: null,
      })
      .eq('id', id)
    onUpdated()
  }

  async function deleteContent(id: string) {
    await supabase.from('geo_content').delete().eq('id', id)
    onUpdated()
  }

  if (content.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <div className="w-12 h-12 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No AI content yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Generate AI-optimized articles, comparisons, and FAQs that AI models will cite when answering questions about your client&apos;s industry.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_90px_90px_100px_80px] border-b border-gray-200 bg-gray-50">
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Content
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Type
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
          Status
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
          <span className="inline-flex gap-3">
            <span title="ChatGPT">G</span>
            <span title="Claude">C</span>
            <span title="Gemini">G</span>
          </span>
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
        </div>
      </div>

      {/* Rows */}
      {content.map((item) => {
        const type = typeLabels[item.content_type] || typeLabels.article
        return (
          <div key={item.id} className="border-b border-gray-100 last:border-b-0">
            <div className="grid grid-cols-[1fr_90px_90px_100px_80px] items-center">
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                  Prompt: {item.target_prompt}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(item.created_at)}</p>
              </div>
              <div className="px-4 py-3">
                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${type.bg} ${type.text}`}>
                  {type.label}
                </span>
              </div>
              <div className="px-4 py-3 text-center">
                {item.status === 'published' ? (
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700">
                    Published
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                    Draft
                  </span>
                )}
              </div>
              <div className="px-4 py-3 flex items-center justify-center gap-4">
                <CitationDot cited={item.cited_by_gpt} />
                <CitationDot cited={item.cited_by_claude} />
                <CitationDot cited={item.cited_by_gemini} />
              </div>
              <div className="px-4 py-3 flex items-center justify-center gap-2">
                {item.status === 'draft' ? (
                  <>
                    <button
                      onClick={() => handlePublish(item.id)}
                      className="text-brand hover:text-brand-dark transition-colors"
                      title="Publish now"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setSchedulingId(item.id); setScheduleDate('') }}
                      className="text-gray-400 hover:text-amber-500 transition-colors"
                      title="Schedule publish"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                    </button>
                    {wpConnections.length > 0 && (
                      <button
                        onClick={() => pushToWordPress(item.id, wpConnections[0].id)}
                        disabled={pushingId === item.id}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title={`Push to ${wpConnections[0].site_url}`}
                      >
                        {pushingId === item.id ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.397-.026-.766-.07-1.109zm-7.981.105c.647-.034 1.23-.1 1.23-.1.578-.068.51-.919-.068-.886 0 0-1.738.136-2.86.136-1.054 0-2.826-.136-2.826-.136-.578-.033-.645.852-.068.886 0 0 .549.066 1.13.1l1.679 4.606-2.359 7.072-3.927-11.678c.647-.034 1.23-.1 1.23-.1.578-.068.51-.919-.068-.886 0 0-1.738.136-2.86.136-.201 0-.438-.008-.69-.015C4.38 3.648 7.853 2 11.787 2c2.926 0 5.591 1.12 7.588 2.953-.048-.003-.095-.014-.144-.014-1.054 0-1.8.919-1.8 1.906 0 .886.51 1.636 1.054 2.522.408.715.886 1.636.886 2.962 0 .919-.354 1.985-.82 3.47l-1.075 3.59-3.888-11.559z"/></svg>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => unpublish(item.id)}
                    className="text-gray-400 hover:text-amber-500 transition-colors"
                    title="Unpublish"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.5 10.677a2 2 0 002.823 2.823M7.362 7.561A7 7 0 003 12s3 7 9 7a6.965 6.965 0 004.638-1.762M9.88 4.245A7 7 0 0112 3.5c6 0 9 7 9 7a13.16 13.16 0 01-1.258 1.832" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => deleteContent(item.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Publish URL inline editor */}
            {editingUrl === item.id && (
              <div className="px-4 pb-3 flex items-center gap-2">
                <input
                  type="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://yourdomain.com/blog/article-slug"
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={() => savePublishedUrl(item.id)}
                  disabled={!urlValue.trim()}
                  className="px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingUrl(null)}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Schedule inline editor */}
            {schedulingId === item.id && (
              <div className="px-4 pb-3 flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={() => handleSchedule(item.id)}
                  disabled={!scheduleDate}
                  className="px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  Schedule
                </button>
                <button
                  onClick={() => setSchedulingId(null)}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
