'use client'

import { useState } from 'react'

interface PortalData {
  client_name: string
  industry: string | null
  brand_name: string | null
  brand_logo_url: string | null
  accent_color: string
  visibilityScore: number
  platformRates: { name: string; mentionRate: number; color: string }[]
  gapCount: number
  totalScans: number
}

export default function PortalPage({ params }: { params: { slug: string } }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PortalData | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/portal/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: params.slug, password }),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Access denied')
      } else {
        setData(result)
      }
    } catch (e) {
      console.error('Failed to load portal data:', e)
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // Login screen
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Intelligence Portal</h1>
          <p className="text-sm text-gray-500 mb-6">Enter your password to view your dashboard.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="Portal password"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Dashboard
  const accentColor = data.accent_color || '#7C3AED'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header
        className="px-8 py-5 text-white"
        style={{ backgroundColor: accentColor }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.brand_logo_url ? (
              <img src={data.brand_logo_url} alt="" className="h-8" />
            ) : (
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.95" />
                  <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#5DCAA5" fillOpacity="0.75" />
                  <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#5DCAA5" fillOpacity="0.75" />
                  <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.95" />
                </svg>
              </div>
            )}
            <span className="text-lg font-bold">
              {data.brand_name || 'Intelligence Report'}
            </span>
          </div>
          <span className="text-sm text-white/80">{data.client_name}</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* Stats */}
        <div className="bg-white border border-gray-200 rounded-xl grid grid-cols-3 divide-x divide-gray-200">
          <div className="px-6 py-5 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">AI Visibility Score</p>
            <p className="mt-1 text-3xl font-bold" style={{ color: accentColor }}>{data.visibilityScore}%</p>
          </div>
          <div className="px-6 py-5 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Competitor Gaps</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{data.gapCount}</p>
          </div>
          <div className="px-6 py-5 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Scans</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{data.totalScans}</p>
          </div>
        </div>

        {/* Platform Bars */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">AI Platform Mention Rates</h2>
          <div className="space-y-4">
            {data.platformRates.map((platform) => (
              <div key={platform.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-700">{platform.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{platform.mentionRate}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${platform.mentionRate}%`, backgroundColor: platform.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          Powered by {data.brand_name || 'Citari'} · Updated daily
        </p>
      </div>
    </div>
  )
}
