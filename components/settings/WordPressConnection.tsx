'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Connection {
  id: string
  site_url: string
  is_active: boolean
}

export default function WordPressConnection() {
  const supabase = createClient()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [siteUrl, setSiteUrl] = useState('')
  const [username, setUsername] = useState('')
  const [appPassword, setAppPassword] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('cms_connections')
          .select('id, site_url, is_active')
          .eq('platform', 'wordpress')
        setConnections(data || [])
      } catch { /* */ }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setConnecting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/integrations/wordpress/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_url: siteUrl, username, application_password: appPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
      } else {
        setSuccess(`Connected to ${siteUrl}`)
        setShowForm(false)
        setSiteUrl('')
        setUsername('')
        setAppPassword('')
        // Refresh connections
        const { data: updated } = await supabase
          .from('cms_connections')
          .select('id, site_url, is_active')
          .eq('platform', 'wordpress')
        setConnections(updated || [])
      }
    } catch {
      setError('Network error')
    }
    setConnecting(false)
  }

  async function disconnect(id: string) {
    await supabase.from('cms_connections').update({ is_active: false }).eq('id', id)
    setConnections((prev) => prev.map((c) => c.id === id ? { ...c, is_active: false } : c))
  }

  async function reconnect(id: string) {
    await supabase.from('cms_connections').update({ is_active: true }).eq('id', id)
    setConnections((prev) => prev.map((c) => c.id === id ? { ...c, is_active: true } : c))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.397-.026-.766-.07-1.109zm-7.981.105c.647-.034 1.23-.1 1.23-.1.578-.068.51-.919-.068-.886 0 0-1.738.136-2.86.136-1.054 0-2.826-.136-2.826-.136-.578-.033-.645.852-.068.886 0 0 .549.066 1.13.1l1.679 4.606-2.359 7.072-3.927-11.678c.647-.034 1.23-.1 1.23-.1.578-.068.51-.919-.068-.886 0 0-1.738.136-2.86.136-.201 0-.438-.008-.69-.015C4.38 3.648 7.853 2 11.787 2c2.926 0 5.591 1.12 7.588 2.953-.048-.003-.095-.014-.144-.014-1.054 0-1.8.919-1.8 1.906 0 .886.51 1.636 1.054 2.522.408.715.886 1.636.886 2.962 0 .919-.354 1.985-.82 3.47l-1.075 3.59-3.888-11.559z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">WordPress</h3>
            <p className="text-xs text-gray-500">Push GEO content as draft posts</p>
          </div>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark">
            {connections.length > 0 ? 'Add site' : 'Connect'}
          </button>
        )}
      </div>

      {/* Existing connections */}
      {connections.length > 0 && (
        <div className="divide-y divide-gray-100">
          {connections.map((conn) => (
            <div key={conn.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{conn.site_url}</p>
                <span className={`text-xs ${conn.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                  {conn.is_active ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {conn.is_active ? (
                <button onClick={() => disconnect(conn.id)} className="text-xs text-gray-400 hover:text-red-500">Disconnect</button>
              ) : (
                <button onClick={() => reconnect(conn.id)} className="text-xs text-brand hover:underline">Reconnect</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Connect form */}
      {showForm && (
        <form onSubmit={handleConnect} className="p-5 space-y-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">
            Use a WordPress Application Password (Settings → Users → Application Passwords in your WP admin).
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Site URL</label>
            <input type="text" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="https://yoursite.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="admin" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Application Password</label>
              <input type="password" value={appPassword} onChange={(e) => setAppPassword(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="xxxx xxxx xxxx xxxx" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={connecting}
              className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50">
              {connecting ? 'Testing...' : 'Connect'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          </div>
        </form>
      )}

      {loading && connections.length === 0 && !showForm && (
        <div className="p-5 text-center"><p className="text-sm text-gray-400">Loading...</p></div>
      )}
    </div>
  )
}
