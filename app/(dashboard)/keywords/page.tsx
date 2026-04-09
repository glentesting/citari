'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import PageHeader from '@/components/layout/PageHeader'
import BacklinkOpportunities from '@/components/keywords/BacklinkOpportunities'
import type { Keyword } from '@/types'

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
}

const aiVisibleColors: Record<string, string> = {
  yes: 'bg-green-50 text-green-700',
  partial: 'bg-amber-50 text-amber-700',
  no: 'bg-gray-100 text-gray-600',
}

const trendIcons: Record<string, string> = {
  up: '↑',
  down: '↓',
  flat: '—',
}

export default function KeywordsPage() {
  const { activeClient } = useClient()
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [adding, setAdding] = useState(false)
  const [generating, setGenerating] = useState(false)
  const supabase = createClient()

  async function handleGenerateKeywords() {
    if (!activeClient) return
    setGenerating(true)
    try {
      // Call setup endpoint which generates keywords
      await fetch('/api/clients/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id }),
      })
      fetchKeywords()
    } catch { /* */ }
    setGenerating(false)
  }

  const fetchKeywords = useCallback(async () => {
    if (!activeClient) { setKeywords([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('keywords')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('opportunity', { ascending: true })
      .order('your_rank', { ascending: true, nullsFirst: false })
    setKeywords(data || [])
    setLoading(false)
  }, [activeClient])

  useEffect(() => { fetchKeywords() }, [fetchKeywords])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!activeClient || !newKeyword.trim()) return
    setAdding(true)
    await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: activeClient.id, action: 'add', keyword: newKeyword.trim() }),
    })
    setNewKeyword('')
    setShowAdd(false)
    setAdding(false)
    fetchKeywords()
  }

  async function handleRefresh() {
    if (!activeClient) return
    setRefreshing(true)
    await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: activeClient.id, action: 'refresh' }),
    })
    setRefreshing(false)
    fetchKeywords()
  }

  async function deleteKeyword(id: string) {
    await supabase.from('keywords').delete().eq('id', id)
    fetchKeywords()
  }

  if (!activeClient) {
    return (
      <div>
        <PageHeader title="Keywords" subtitle="Track keyword rankings and AI visibility" />
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">Select or add a client to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Keywords"
        subtitle={`${keywords.length} keyword${keywords.length !== 1 ? 's' : ''} tracked for ${activeClient.name}`}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd(!showAdd)}
              className="px-4 py-2 text-sm font-medium text-brand border border-brand-border rounded-lg hover:bg-brand-bg transition-colors">
              Add Keyword
            </button>
            <button onClick={handleRefresh} disabled={refreshing || keywords.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50">
              {refreshing ? 'Refreshing...' : 'Refresh Rankings'}
            </button>
          </div>
        }
      />

      <div className="mt-6 space-y-4">
        {/* Add keyword form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-4 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Keyword</label>
              <input type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="best project management software" />
            </div>
            <button type="submit" disabled={adding || !newKeyword.trim()}
              className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50">
              {adding ? 'Adding...' : 'Add'}
            </button>
          </form>
        )}

        {/* Keywords table */}
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400">Loading keywords...</p>
          </div>
        ) : keywords.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <div className="w-12 h-12 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No keywords tracked yet</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
              Track where {activeClient.name} ranks on Google and whether those keywords show up in AI responses.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={handleGenerateKeywords} disabled={generating}
                className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50">
                {generating ? 'Generating...' : 'Auto-Generate Top Keywords'}
              </button>
              <button onClick={() => setShowAdd(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Add manually
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_80px_80px_120px_80px_70px_60px_40px] border-b border-gray-200 bg-gray-50">
              <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Keyword</div>
              <div className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center" title="Monthly search volume — how many people search this term per month. Dashes mean data hasn't been fetched yet — click Refresh Rankings.">Volume <span className="inline-block w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[9px] leading-[14px] text-center cursor-help">i</span></div>
              <div className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Difficulty</div>
              <div className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Rank</div>
              <div className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Top Competitor</div>
              <div className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">AI Visible</div>
              <div className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center" title="Opportunity score — high means this keyword has strong potential based on competition vs volume. High = pursue it.">Opp. <span className="inline-block w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[9px] leading-[14px] text-center cursor-help">i</span></div>
              <div className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Trend</div>
              <div className="px-3 py-3"></div>
            </div>

            {keywords.map((kw) => (
              <div key={kw.id} className="grid grid-cols-[1fr_90px_80px_80px_120px_80px_70px_60px_40px] border-b border-gray-100 last:border-b-0">
                <div className="px-4 py-3 text-sm text-gray-900 flex items-center">
                  <span className="truncate">{kw.keyword}</span>
                </div>
                <div className="px-3 py-3 text-sm text-gray-600 text-center">
                  {kw.monthly_volume != null ? kw.monthly_volume.toLocaleString() : '—'}
                </div>
                <div className="px-3 py-3 flex items-center justify-center">
                  {kw.difficulty ? (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${difficultyColors[kw.difficulty]}`}>
                      {kw.difficulty}
                    </span>
                  ) : <span className="text-gray-400 text-sm">—</span>}
                </div>
                <div className="px-3 py-3 text-sm font-semibold text-center">
                  {kw.your_rank != null ? (
                    <span className={kw.your_rank <= 3 ? 'text-green-600' : kw.your_rank <= 10 ? 'text-gray-900' : 'text-red-600'}>
                      #{kw.your_rank}
                    </span>
                  ) : <span className="text-gray-400">—</span>}
                </div>
                <div className="px-3 py-3 text-xs text-gray-600 flex items-center">
                  {kw.top_competitor_name ? (
                    <span className="truncate">
                      {kw.top_competitor_name} {kw.top_competitor_rank && <span className="text-gray-400">#{kw.top_competitor_rank}</span>}
                    </span>
                  ) : <span className="text-gray-400">—</span>}
                </div>
                <div className="px-3 py-3 flex items-center justify-center">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${aiVisibleColors[kw.ai_visible || 'no']}`}>
                    {kw.ai_visible || 'no'}
                  </span>
                </div>
                <div className="px-3 py-3 flex items-center justify-center">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    kw.opportunity === 'high' ? 'bg-green-50 text-green-700' :
                    kw.opportunity === 'medium' ? 'bg-amber-50 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{kw.opportunity || 'medium'}</span>
                </div>
                <div className="px-3 py-3 text-center">
                  <span className={`text-sm font-medium ${
                    kw.trend === 'up' ? 'text-green-600' : kw.trend === 'down' ? 'text-red-600' : 'text-gray-400'
                  }`}>{trendIcons[kw.trend || 'flat']}</span>
                </div>
                <div className="px-2 py-3 flex items-center justify-center">
                  <button onClick={() => deleteKeyword(kw.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {keywords.length > 0 && (
          <p className="text-xs text-gray-400 -mt-2">Click &quot;Refresh Rankings&quot; to fetch live ranking data from Google for all tracked keywords.</p>
        )}

        <BacklinkOpportunities />
      </div>
    </div>
  )
}
