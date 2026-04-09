'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { GeoContent } from '@/types'
import { formatDate } from '@/lib/utils'

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
  const supabase = createClient()
  const [editingUrl, setEditingUrl] = useState<string | null>(null)
  const [urlValue, setUrlValue] = useState('')

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

    setEditingUrl(null)
    setUrlValue('')
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
        <h3 className="text-base font-semibold text-gray-900 mb-1">No GEO content yet</h3>
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
                  <button
                    onClick={() => handlePublish(item.id)}
                    className="text-brand hover:text-brand-dark transition-colors"
                    title="Publish"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                    </svg>
                  </button>
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
          </div>
        )
      })}
    </div>
  )
}
