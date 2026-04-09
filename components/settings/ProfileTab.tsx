'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ProfileTab() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Profile fields
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [timezone, setTimezone] = useState('America/Chicago')

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  // Delete account
  const [showDelete, setShowDelete] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  // Stats
  const [stats, setStats] = useState({ clients: 0, prompts: 0, reports: 0 })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email || '')
      setFirstName(user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || '')
      setLastName(user.user_metadata?.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '')
      setCompany(user.user_metadata?.company || '')
      setRole(user.user_metadata?.role || '')
      setTimezone(user.user_metadata?.timezone || 'America/Chicago')

      // Fetch stats
      const { data: settings } = await supabase.from('user_settings').select('workspace_id').eq('user_id', user.id).single()
      if (settings?.workspace_id) {
        const [c, p, r] = await Promise.all([
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('workspace_id', settings.workspace_id),
          supabase.from('prompts').select('id', { count: 'exact', head: true }),
          supabase.from('reports').select('id', { count: 'exact', head: true }).eq('workspace_id', settings.workspace_id),
        ])
        setStats({ clients: c.count || 0, prompts: p.count || 0, reports: r.count || 0 })
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim(), company, role, timezone },
    })

    setMessage(error ? error.message : 'Profile updated')
    setSaving(false)
  }

  async function handleChangeEmail() {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ email })
    setMessage(error ? error.message : 'Confirmation email sent to new address')
    setSaving(false)
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMessage(null)
    if (newPassword !== confirmPassword) { setPasswordMessage('Passwords do not match'); return }
    if (newPassword.length < 6) { setPasswordMessage('Password must be at least 6 characters'); return }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordMessage(error ? error.message : 'Password updated')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  async function handleDeleteAccount() {
    // Delete via service role would be needed for full cleanup
    // For now, sign out and show message
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = `${firstName?.[0] || ''}${lastName?.[0] || email?.[0] || '?'}`.toUpperCase()
  const canDelete = deleteEmail === email && deleteConfirm === 'delete my entire account'

  if (loading) {
    return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center"><p className="text-sm text-gray-400">Loading profile...</p></div>
  }

  return (
    <div className="space-y-6">
      {/* Profile card + form */}
      <div className="grid grid-cols-[200px_1fr] gap-6">
        {/* Left: Avatar card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
          <div className="w-20 h-20 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-brand">{initials}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{firstName} {lastName}</p>
          <p className="text-xs text-gray-500">{email}</p>
          {role && <p className="text-xs text-gray-400 mt-1">{role}</p>}
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-bold text-gray-900">{stats.clients}</p><p className="text-[10px] text-gray-500">Clients</p></div>
            <div><p className="text-lg font-bold text-gray-900">{stats.prompts}</p><p className="text-[10px] text-gray-500">Prompts</p></div>
            <div><p className="text-lg font-bold text-gray-900">{stats.reports}</p><p className="text-[10px] text-gray-500">Reports</p></div>
          </div>
        </div>

        {/* Right: Forms */}
        <div className="space-y-6">
          {/* Personal Info */}
          <form onSubmit={handleSaveProfile} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <div className="flex gap-2">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
                <button type="button" onClick={handleChangeEmail} className="px-3 py-2 text-xs font-medium text-brand border border-brand-border rounded-lg hover:bg-brand-bg">Update</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role / Title</label>
                <input type="text" value={role} onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white">
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Central European</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Australia/Sydney">Sydney</option>
              </select>
            </div>
            {message && <p className={`text-sm ${message.includes('error') || message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>

          {/* Security */}
          <form onSubmit={handleUpdatePassword} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Security</h3>
            <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
            <div className="grid grid-cols-2 gap-4">
              <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
              <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
            </div>
            {passwordMessage && <p className={`text-sm ${passwordMessage.includes('match') || passwordMessage.includes('error') ? 'text-red-600' : 'text-green-600'}`}>{passwordMessage}</p>}
            <button type="submit" disabled={!newPassword}
              className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50">
              Update Password
            </button>
          </form>

          {/* Danger Zone */}
          <div className="bg-white border-2 border-red-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-red-600 mb-2">Danger Zone</h3>
            {!showDelete ? (
              <button onClick={() => setShowDelete(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors">
                Delete Account
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type your email to confirm</label>
                  <input type="text" value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder={email} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type &quot;delete my entire account&quot; to confirm</label>
                  <input type="text" value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    onPaste={(e) => e.preventDefault()}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="delete my entire account" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDeleteAccount} disabled={!canDelete}
                    className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Permanently Delete Account
                  </button>
                  <button onClick={() => { setShowDelete(false); setDeleteEmail(''); setDeleteConfirm('') }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Sign Out */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <button onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
