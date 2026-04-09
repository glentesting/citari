'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import PageHeader from '@/components/layout/PageHeader'
import ContentGenerator from '@/components/geo/ContentGenerator'
import ContentLibrary from '@/components/geo/ContentLibrary'
import type { GeoContent } from '@/types'

export default function GeoPage() {
  const { activeClient } = useClient()
  const [content, setContent] = useState<GeoContent[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchContent = useCallback(async () => {
    if (!activeClient) {
      setContent([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data } = await supabase
      .from('geo_content')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('created_at', { ascending: false })

    setContent(data || [])
    setLoading(false)
  }, [activeClient])

  useEffect(() => {
    fetchContent()
  }, [fetchContent])

  const publishedCount = content.filter((c) => c.status === 'published').length
  const citedCount = content.filter(
    (c) => c.cited_by_gpt || c.cited_by_claude || c.cited_by_gemini
  ).length

  if (!activeClient) {
    return (
      <div>
        <PageHeader
          title="GEO Content"
          subtitle="Generate AI-optimized content for your clients"
        />
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mt-6">
          <p className="text-sm text-gray-500">Select or add a client to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="GEO Content"
        subtitle={`${content.length} pieces created${publishedCount > 0 ? ` · ${publishedCount} published` : ''}${citedCount > 0 ? ` · ${citedCount} cited by AI` : ''}`}
      />

      <div className="mt-6 space-y-8">
        <ContentGenerator onGenerated={fetchContent} />

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-[2.5px] h-4 bg-brand rounded-full" />
            Content Library
            <span className="text-xs font-normal text-gray-400">({content.length})</span>
          </h3>
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">Loading content...</p>
            </div>
          ) : (
            <ContentLibrary content={content} onUpdated={fetchContent} />
          )}
        </div>
      </div>
    </div>
  )
}
