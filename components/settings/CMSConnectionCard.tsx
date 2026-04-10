'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CMSConnectionCardProps {
  platform: string
  name: string
  desc: string
  color: string
  textColor: string
  fields: { key: string; label: string; placeholder: string; type?: string; help?: string }[]
  connectEndpoint: string
}

export default function CMSConnectionCard({ platform, name, desc, color, textColor, fields, connectEndpoint }: CMSConnectionCardProps) {
  const supabase = createClient()
  const [connected, setConnected] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    async function check() {
      try {
        const { data } = await supabase.from('cms_connections').select('id').eq('platform', platform).eq('is_active', true).limit(1)
        setConnected((data || []).length > 0)
      } catch (e) { console.error(`CMS connection check failed for ${platform}:`, e) }
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform])

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setConnecting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(connectEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const text = await res.text()
      if (!text) { setError('Server timed out'); setConnecting(false); return }
      const data = JSON.parse(text)
      if (!res.ok) setError(data.error || 'Connection failed')
      else { setSuccess(`Connected to ${name}`); setConnected(true); setShowForm(false) }
    } catch (err: any) { setError(err.message || 'Failed') }
    setConnecting(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center`}>
            <span className={`text-xs font-bold ${textColor}`}>{name[0]}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
        </div>
        {connected ? (
          <span className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg">Connected</span>
        ) : (
          <button onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark">
            Connect
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleConnect} className="px-5 pb-4 space-y-3 border-t border-gray-100 pt-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input
                type={f.type || 'text'}
                value={values[f.key] || ''}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder={f.placeholder}
              />
              {f.help && <p className="text-[10px] text-gray-400 mt-1">{f.help}</p>}
            </div>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {success && <p className="text-xs text-green-600">{success}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={connecting}
              className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50">
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
