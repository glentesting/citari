'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function WorkspaceModeTab() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [mode, setMode] = useState<'consultant' | 'direct'>('direct')
  const [consultantName, setConsultantName] = useState('')
  const [consultantEmail, setConsultantEmail] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data: settings } = await supabase
          .from('user_settings')
          .select('workspace_id')
          .eq('user_id', user.id)
          .single()

        if (settings?.workspace_id) {
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('mode, consultant_name, consultant_email')
            .eq('id', settings.workspace_id)
            .single()

          if (workspace) {
            setMode((workspace.mode as 'consultant' | 'direct') || 'direct')
            setConsultantName(workspace.consultant_name || '')
            setConsultantEmail(workspace.consultant_email || '')
          }
        }
      } catch (e) { console.error('Failed to load workspace settings:', e) }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaving(false); return }

      const { data: settings } = await supabase
        .from('user_settings')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (settings?.workspace_id) {
        await supabase
          .from('workspaces')
          .update({
            mode,
            consultant_name: mode === 'consultant' ? consultantName : null,
            consultant_email: mode === 'consultant' ? consultantEmail : null,
          })
          .eq('id', settings.workspace_id)

        setMessage('Settings saved')
      }
    } catch (e) {
      console.error('Failed to save workspace mode settings:', e)
      setMessage('Failed to save')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center"><p className="text-sm text-gray-400">Loading...</p></div>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Workspace Mode</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Controls how alerts and reports are formatted and who receives them.
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setMode('direct')}
            className={`px-4 py-3 rounded-lg border text-left transition-colors ${
              mode === 'direct' ? 'border-brand bg-brand-bg' : 'border-gray-200 hover:bg-gray-50'
            }`}>
            <span className={`block text-sm font-semibold ${mode === 'direct' ? 'text-brand' : 'text-gray-900'}`}>
              Direct Mode
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              You are the business owner. Alerts in plain English with simple next steps.
            </span>
          </button>
          <button onClick={() => setMode('consultant')}
            className={`px-4 py-3 rounded-lg border text-left transition-colors ${
              mode === 'consultant' ? 'border-brand bg-brand-bg' : 'border-gray-200 hover:bg-gray-50'
            }`}>
            <span className={`block text-sm font-semibold ${mode === 'consultant' ? 'text-brand' : 'text-gray-900'}`}>
              Consultant Mode
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              You manage clients. Strategic alerts with data and action recommendations.
            </span>
          </button>
        </div>

        {/* Consultant info */}
        {mode === 'consultant' && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Consultant / Agency name</label>
              <input type="text" value={consultantName} onChange={(e) => setConsultantName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="OrangeCore Group" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Consultant email (alerts sent here)</label>
              <input type="email" value={consultantEmail} onChange={(e) => setConsultantEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="you@agency.com" />
            </div>
          </div>
        )}

        {message && <p className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}

        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
