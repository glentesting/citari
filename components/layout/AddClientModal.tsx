'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import { useRouter } from 'next/navigation'

interface AddClientModalProps {
  onClose: () => void
}

interface ScanResult {
  name: string
  description: string
  specialization: string
  location: string
  target_clients: string
  differentiators: string
  industry: string
}

const setupSteps = [
  { label: 'Discovering competitors...', key: 'competitors' },
  { label: 'Crawling competitor websites...', key: 'crawl' },
  { label: 'Generating tracking prompts...', key: 'prompts' },
  { label: 'Finding keyword opportunities...', key: 'keywords' },
  { label: 'Running competitive intelligence...', key: 'intel' },
]

export default function AddClientModal({ onClose }: AddClientModalProps) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')

  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanError, setScanError] = useState(false)

  // Edit mode for manual override
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState<ScanResult>({
    name: '', description: '', specialization: '', location: '',
    target_clients: '', differentiators: '', industry: '',
  })

  // Save/setup state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingUp, setSettingUp] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const { refreshClients, setActiveClient } = useClient()
  const supabase = createClient()
  const router = useRouter()

  async function handleDomainBlur() {
    const d = domain.trim()
    if (!d || scanning || scanResult) return
    setScanning(true)
    setScanError(false)
    try {
      const res = await fetch('/api/clients/analyze-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d }),
      })
      if (res.ok) {
        const data = await res.json()
        setScanResult(data)
        setEditFields(data)
        if (data.name && !name) setName(data.name)
      } else {
        setScanError(true)
      }
    } catch (e) {
      console.error('Domain scan failed:', e)
      setScanError(true)
    }
    setScanning(false)
  }

  function handleDomainChange(val: string) {
    setDomain(val)
    // Reset scan when domain changes
    if (scanResult) {
      setScanResult(null)
      setEditFields({ name: '', description: '', specialization: '', location: '', target_clients: '', differentiators: '', industry: '' })
      setEditing(false)
      setScanError(false)
    }
  }

  function getActiveData(): ScanResult {
    if (editing) return editFields
    if (scanResult) return scanResult
    return editFields
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!settings?.workspace_id) { setError('No workspace found'); setLoading(false); return }

    const data = getActiveData()

    const { data: client, error: insertError } = await supabase
      .from('clients')
      .insert({
        workspace_id: settings.workspace_id,
        name: name || data.name,
        domain: domain || null,
        industry: data.industry || null,
        location: data.location || null,
        specialization: data.specialization || null,
        description: data.description || null,
        target_clients: data.target_clients || null,
        differentiators: data.differentiators || null,
      })
      .select()
      .single()

    if (insertError) { setError(insertError.message); setLoading(false); return }

    await refreshClients()
    if (client) setActiveClient(client)

    if (!client) { onClose(); return }

    // Fire setup in background — don't block navigation
    fetch('/api/clients/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: client.id }),
    }).catch((e) => console.error('Client setup failed:', e))

    setLoading(false)
    onClose()
    router.push('/overview')
    router.refresh()
  }

  // Setup loading screen
  if (settingUp) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-brand animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Setting up {name}...</h2>
            <p className="text-sm text-gray-500 mt-1">Building your competitive intelligence — about 60 seconds</p>
          </div>

          <div className="space-y-3">
            {setupSteps.map((step, i) => (
              <div key={step.key} className="flex items-center gap-3">
                {i < currentStep ? (
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                ) : i === currentStep ? (
                  <div className="w-6 h-6 rounded-full bg-brand-bg flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0" />
                )}
                <span className={`text-sm ${
                  i < currentStep ? 'text-green-600 font-medium' :
                  i === currentStep ? 'text-gray-900 font-medium' :
                  'text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add new client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
              Client name <span className="text-red-500">*</span>
            </label>
            <input id="clientName" type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="Acme Corp" />
          </div>

          <div>
            <label htmlFor="clientDomain" className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <input id="clientDomain" type="text" value={domain} onChange={(e) => handleDomainChange(e.target.value)}
              onBlur={handleDomainBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="acme.com" />

            {scanning && (
              <div className="mt-2 flex items-center gap-2 text-xs text-brand">
                <div className="w-3 h-3 rounded-full bg-brand animate-pulse" />
                Analyzing website...
              </div>
            )}

            {scanError && !scanning && (
              <p className="mt-1 text-xs text-gray-400">
                Could not scan website.{' '}
                <button type="button" onClick={() => setEditing(true)} className="text-brand hover:underline">Enter details manually</button>
              </p>
            )}
          </div>

          {/* Scan result preview card */}
          {scanResult && !editing && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What we found</p>
              {scanResult.industry && (
                <div className="flex gap-2 text-sm"><span className="text-gray-400 w-24 flex-shrink-0">Industry</span><span className="text-gray-900">{scanResult.industry}</span></div>
              )}
              {scanResult.specialization && (
                <div className="flex gap-2 text-sm"><span className="text-gray-400 w-24 flex-shrink-0">Specialization</span><span className="text-gray-900">{scanResult.specialization}</span></div>
              )}
              {scanResult.location && (
                <div className="flex gap-2 text-sm"><span className="text-gray-400 w-24 flex-shrink-0">Locations</span><span className="text-gray-900">{scanResult.location}</span></div>
              )}
              {scanResult.target_clients && (
                <div className="flex gap-2 text-sm"><span className="text-gray-400 w-24 flex-shrink-0">Serves</span><span className="text-gray-900">{scanResult.target_clients}</span></div>
              )}
              {scanResult.description && (
                <p className="text-xs text-gray-600 pt-1 border-t border-gray-200 mt-2">{scanResult.description}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditing(true)}
                  className="text-xs text-brand hover:underline">
                  Edit details
                </button>
              </div>
            </div>
          )}

          {/* Editable fields — shown ONLY when user explicitly clicks Edit */}
          {editing && (
            <div className="space-y-3">
              {editing && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit details</p>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Industry</label>
                <input type="text" value={editFields?.industry || ''} onChange={(e) => setEditFields((prev) => ({ ...prev, industry: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  placeholder="Law, SaaS, Roofing, etc." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Specialization</label>
                <input type="text" value={editFields?.specialization || ''} onChange={(e) => setEditFields((prev) => ({ ...prev, specialization: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  placeholder="e.g. Healthcare business law, corporate law" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                <input type="text" value={editFields?.location || ''} onChange={(e) => setEditFields((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  placeholder="e.g. Texas, Indiana, Georgia" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea value={editFields?.description || ''} onChange={(e) => setEditFields((prev) => ({ ...prev, description: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                  placeholder="Brief description of what they do and who their clients are" />
              </div>
              {editing && (
                <button type="button" onClick={() => { setScanResult(editFields); setEditing(false) }}
                  className="text-xs text-brand hover:underline">Done editing</button>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || scanning || !name.trim()}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50">
              {loading ? 'Creating...' : scanResult ? 'Looks right — Add client' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
