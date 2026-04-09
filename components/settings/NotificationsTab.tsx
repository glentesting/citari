'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const notifications = [
  { key: 'alert_on_drop', label: 'Visibility Drop Alert', desc: 'Get notified when AI visibility drops more than 5% for any client' },
  { key: 'weekly_digest', label: 'Weekly Digest', desc: 'Receive a weekly summary of all client visibility scores and changes' },
  { key: 'competitor_alert', label: 'Competitor Activity', desc: 'Alert when a competitor publishes content targeting your tracked prompts' },
  { key: 'scan_complete', label: 'Scan Complete', desc: 'Notification when daily automated scans finish for all clients' },
  { key: 'content_published', label: 'Content Published', desc: 'Confirmation when scheduled content is published to your CMS' },
  { key: 'model_drift', label: 'AI Model Changes', desc: 'Alert when an AI model changes its response patterns significantly' },
]

export default function NotificationsTab() {
  const supabase = createClient()
  const [settings, setSettings] = useState<Record<string, boolean>>({
    alert_on_drop: true,
    weekly_digest: true,
    competitor_alert: false,
    scan_complete: false,
    content_published: true,
    model_drift: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data } = await supabase
          .from('user_settings')
          .select('alert_on_drop, weekly_digest')
          .eq('user_id', user.id)
          .single()

        if (data) {
          setSettings((prev) => ({
            ...prev,
            alert_on_drop: data.alert_on_drop ?? true,
            weekly_digest: data.weekly_digest ?? true,
          }))
        }
      } catch { /* */ }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleSetting(key: string) {
    const newVal = !settings[key]
    setSettings((prev) => ({ ...prev, [key]: newVal }))

    // Save the ones that are in the DB
    if (key === 'alert_on_drop' || key === 'weekly_digest') {
      setSaving(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('user_settings').update({ [key]: newVal }).eq('user_id', user.id)
        }
      } catch { /* */ }
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center"><p className="text-sm text-gray-400">Loading...</p></div>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Email Notifications</h3>
        <p className="text-xs text-gray-500 mt-0.5">Choose which alerts you want to receive via email.</p>
      </div>
      <div className="divide-y divide-gray-100">
        {notifications.map((n) => (
          <div key={n.key} className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{n.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{n.desc}</p>
            </div>
            <button
              onClick={() => toggleSetting(n.key)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings[n.key] ? 'bg-brand' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                settings[n.key] ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        ))}
      </div>
      {saving && <p className="px-5 py-2 text-xs text-gray-400 border-t border-gray-100">Saving...</p>}
    </div>
  )
}
