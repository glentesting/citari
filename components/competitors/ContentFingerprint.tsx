'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CompetitorContentItem {
  id: string
  url: string
  title: string
  excerpt: string
  likely_cited: boolean
  citation_prompt_ids: string[]
  crawled_at: string
}

interface ContentFingerprintProps {
  competitorId: string
  competitorName: string
  competitorDomain: string | null
  onDeleted?: () => void
}

export default function ContentFingerprint({
  competitorId,
  competitorName,
  competitorDomain,
  onDeleted,
}: ContentFingerprintProps) {
  const [content, setContent] = useState<CompetitorContentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  async function fetchContent() {
    setLoading(true)
    const { data } = await supabase
      .from('competitor_content')
      .select('*')
      .eq('competitor_id', competitorId)
      .order('likely_cited', { ascending: false })

    setContent(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitorId])

  async function handleCrawl() {
    setCrawling(true)
    setCrawlMessage(null)

    try {
      const res = await fetch('/api/competitors/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_id: competitorId }),
      })

      const data = await res.json()
      if (!res.ok) {
        setCrawlMessage(`Crawl failed: ${data.error}`)
      } else {
        setCrawlMessage(`Crawled ${data.pages_crawled} pages — ${data.likely_cited} likely cited by AI`)
        await fetchContent()
      }
    } catch (e) {
      console.error('Failed to crawl competitor content:', e)
      setCrawlMessage('Crawl failed: Network error')
    } finally {
      setCrawling(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${competitorName} and all their data? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/competitors/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_id: competitorId }),
      })
      if (res.ok) onDeleted?.()
      else {
        const data = await res.json().catch(() => ({}))
        setCrawlMessage(`Delete failed: ${data.error || 'Unknown error'}`)
      }
    } catch (e) {
      console.error('Failed to delete competitor:', e)
      setCrawlMessage('Delete failed: Network error')
    }
    setDeleting(false)
  }

  const citedContent = content.filter((c) => c.likely_cited)
  const otherContent = content.filter((c) => !c.likely_cited)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{competitorName} Content</h4>
          {competitorDomain && (
            <p className="text-xs text-gray-400 mt-0.5">{competitorDomain}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCrawl}
            disabled={crawling || !competitorDomain}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {crawling ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Crawling...
              </>
            ) : content.length > 0 ? 'Re-crawl' : 'Crawl Content'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
            title="Delete competitor"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {crawlMessage && (
        <div className={`px-5 py-2 text-xs font-medium border-b ${
          crawlMessage.includes('failed')
            ? 'bg-red-50 border-red-100 text-red-700'
            : 'bg-brand-bg border-brand-border text-brand'
        }`}>
          {crawlMessage}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-400">Loading content...</p>
        </div>
      ) : content.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">
            {competitorDomain
              ? 'No content crawled yet. Click "Crawl Content" to scan their sitemap.'
              : 'Add a domain to this competitor to enable content crawling.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {/* Cited content first */}
          {citedContent.length > 0 && (
            <div className="px-5 py-2 bg-red-50 border-b border-red-100">
              <p className="text-xs font-semibold text-red-700">
                Likely being cited by AI ({citedContent.length})
              </p>
            </div>
          )}
          {citedContent.map((item) => (
            <ContentRow key={item.id} item={item} />
          ))}

          {/* Other content */}
          {otherContent.length > 0 && citedContent.length > 0 && (
            <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500">
                Other content ({otherContent.length})
              </p>
            </div>
          )}
          {otherContent.map((item) => (
            <ContentRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function ContentRow({ item }: { item: CompetitorContentItem }) {
  return (
    <div className={`px-5 py-3 ${item.likely_cited ? 'bg-red-50/50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-900 hover:text-brand transition-colors line-clamp-1"
          >
            {item.title}
          </a>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.url}</p>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.excerpt.slice(0, 200)}...</p>
        </div>
        {item.likely_cited && (
          <span className="flex-shrink-0 inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
            Cited
          </span>
        )}
      </div>
    </div>
  )
}
