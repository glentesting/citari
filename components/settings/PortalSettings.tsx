'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface PortalAccess {
  id: string
  portal_slug: string
  client_email: string | null
  brand_name: string | null
  accent_color: string
  is_active: boolean
}

export default function PortalSettings() {
  const { activeClient } = useClient()
  const [portal, setPortal] = useState<PortalAccess | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // Form state
  const [slug, setSlug] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [password, setPassword] = useState('')
  const [brandName, setBrandName] = useState('')
  const [accentColor, setAccentColor] = useState('#7C3AED')
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchPortal = useCallback(async () => {
    if (!activeClient) {
      setPortal(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data } = await supabase
      .from('client_portal_access')
      .select('*')
      .eq('client_id', activeClient.id)
      .single()

    if (data) {
      setPortal(data)
      setSlug(data.portal_slug)
      setClientEmail(data.client_email || '')
      setBrandName(data.brand_name || '')
      setAccentColor(data.accent_color || '#7C3AED')
    } else {
      setPortal(null)
      // Generate a default slug from client name
      const defaultSlug = activeClient.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      setSlug(`${defaultSlug}-intel`)
      setClientEmail('')
      setBrandName('')
      setAccentColor('#7C3AED')
    }
    setLoading(false)
  }, [activeClient])

  useEffect(() => {
    fetchPortal()
  }, [fetchPortal])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!activeClient) return
    setSaving(true)
    setError(null)

    // Get workspace_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSaving(false); return }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!settings?.workspace_id) { setError('No workspace'); setSaving(false); return }

    // Hash password if provided
    let passwordHash: string | undefined
    if (password) {
      // Use Web Crypto API for hashing
      const encoder = new TextEncoder()
      const data = encoder.encode(password)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }

    const portalData: any = {
      client_id: activeClient.id,
      workspace_id: settings.workspace_id,
      portal_slug: slug,
      client_email: clientEmail || null,
      brand_name: brandName || null,
      accent_color: accentColor,
      is_active: true,
    }

    if (passwordHash) {
      portalData.portal_password_hash = passwordHash
    }

    let result
    if (portal) {
      result = await supabase
        .from('client_portal_access')
        .update(portalData)
        .eq('id', portal.id)
        .select()
        .single()
    } else {
      if (!password) { setError('Password is required for new portals'); setSaving(false); return }
      result = await supabase
        .from('client_portal_access')
        .insert(portalData)
        .select()
        .single()
    }

    if (result.error) {
      setError(result.error.message)
    } else {
      setPortal(result.data)
      setPassword('')
    }
    setSaving(false)
  }

  async function toggleActive() {
    if (!portal) return
    await supabase
      .from('client_portal_access')
      .update({ is_active: !portal.is_active })
      .eq('id', portal.id)
    fetchPortal()
  }

  function copyLink() {
    const url = `${window.location.origin}/${slug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!activeClient) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-sm text-gray-500">Select a client to manage portal access.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-sm text-gray-400">Loading portal settings...</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Client Portal</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Give {activeClient.name} a branded, read-only dashboard.
          </p>
        </div>
        {portal && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="px-3 py-1.5 text-xs font-medium text-brand border border-brand-border rounded-lg hover:bg-brand-bg transition-colors"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={toggleActive}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                portal.is_active ? 'bg-brand' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                portal.is_active ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Portal slug <span className="text-red-500">*</span>
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 py-2 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-xs text-gray-500">
                yourdomain.com/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="acme-intel"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Client email</label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="client@example.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Password {portal ? '(leave blank to keep current)' : '*'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!portal}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Your brand name</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="OrangeCore Group"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Accent color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving || !slug.trim()}
          className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : portal ? 'Update Portal' : 'Create Portal'}
        </button>
      </form>
    </div>
  )
}
