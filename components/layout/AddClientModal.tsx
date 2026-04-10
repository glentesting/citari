'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import { useRouter } from 'next/navigation'

interface AddClientModalProps {
  onClose: () => void
}

const setupSteps = [
  { label: 'Discovering competitors...', key: 'competitors' },
  { label: 'Generating tracking prompts...', key: 'prompts' },
  { label: 'Finding keyword opportunities...', key: 'keywords' },
  { label: 'Running first AI scan...', key: 'scan' },
]

export default function AddClientModal({ onClose }: AddClientModalProps) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingUp, setSettingUp] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const { refreshClients, setActiveClient } = useClient()
  const supabase = createClient()
  const router = useRouter()

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

    const { data: client, error: insertError } = await supabase
      .from('clients')
      .insert({
        workspace_id: settings.workspace_id,
        name,
        domain: domain || null,
        industry: industry || null,
        location: location || null,
        specialization: specialization || null,
        description: description || null,
      })
      .select()
      .single()

    if (insertError) { setError(insertError.message); setLoading(false); return }

    await refreshClients()
    if (client) setActiveClient(client)

    if (!client) { onClose(); return }

    // Start auto-setup
    setLoading(false)
    setSettingUp(true)
    setCurrentStep(0)

    // Animate through steps while waiting
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => Math.min(prev + 1, setupSteps.length - 1))
    }, 4000)

    try {
      await fetch('/api/clients/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id }),
      })
    } catch (e) {
      console.error('Client setup failed:', e)
      // Setup failed — still continue to dashboard
    }

    clearInterval(stepInterval)
    await refreshClients()
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
            <p className="text-sm text-gray-500 mt-1">This takes about 30-60 seconds</p>
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md">
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
            <input id="clientDomain" type="text" value={domain} onChange={(e) => setDomain(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="acme.com" />
          </div>

          <div>
            <label htmlFor="clientIndustry" className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <input id="clientIndustry" type="text" value={industry} onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="SaaS, Marketing, Roofing, etc." />
          </div>

          <div>
            <label htmlFor="clientLocation" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input id="clientLocation" type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="e.g. Texas, Indiana, Georgia" />
          </div>

          <div>
            <label htmlFor="clientSpecialization" className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
            <input id="clientSpecialization" type="text" value={specialization} onChange={(e) => setSpecialization(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="e.g. Healthcare business law, corporate law" />
          </div>

          <div>
            <label htmlFor="clientDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea id="clientDescription" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
              placeholder="Brief description of what they do and who their clients are" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !name.trim()}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50">
              {loading ? 'Creating...' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
