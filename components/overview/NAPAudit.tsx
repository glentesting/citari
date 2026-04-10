'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface NAPListing {
  id: string
  directory: string
  listed_name: string | null
  listed_phone: string | null
  listed_website: string | null
  is_consistent: boolean
  issues: string[] | null
}

export default function NAPAudit() {
  const { activeClient } = useClient()
  const [listings, setListings] = useState<NAPListing[]>([])
  const [loading, setLoading] = useState(true)
  const [auditing, setAuditing] = useState(false)
  const [auditMsg, setAuditMsg] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      if (!activeClient) { setListings([]); setLoading(false); return }
      setLoading(true)
      const { data } = await supabase.from('nap_listings').select('*').eq('client_id', activeClient.id)
      setListings(data || [])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient])

  async function handleAudit() {
    if (!activeClient) return
    setAuditing(true)
    setAuditMsg(null)
    try {
      const res = await fetch('/api/nap/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id }),
      })
      const data = await res.json()
      setAuditMsg(res.ok ? `Checked ${data.checks} directories — ${data.consistent} consistent` : data.error)
      if (res.ok) {
        const { data: updated } = await supabase.from('nap_listings').select('*').eq('client_id', activeClient.id)
        setListings(updated || [])
      }
    } catch { setAuditMsg('Audit failed') }
    setAuditing(false)
  }

  if (!activeClient) return null

  const consistent = listings.filter((l) => l.is_consistent).length
  const score = listings.length > 0 ? Math.round((consistent / listings.length) * 100) : null

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-[2.5px] h-4 bg-brand rounded-full" />
            Directory Listings
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">NAP = Name, Address, Phone — AI models pull your business info from these directories</p>
          {score !== null && (
            <p className="text-xs text-gray-500 mt-0.5">
              Score: <span className={`font-semibold ${score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{score}%</span> — {consistent}/{listings.length} directories consistent
            </p>
          )}
        </div>
        <button onClick={handleAudit} disabled={auditing}
          className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
          {auditing ? 'Auditing...' : listings.length > 0 ? 'Re-audit' : 'Run Audit'}
        </button>
      </div>

      {auditMsg && (
        <div className={`px-5 py-2 text-xs font-medium border-b ${auditMsg.includes('fail') ? 'bg-red-50 text-red-700' : 'bg-brand-bg text-brand'}`}>
          {auditMsg}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center"><p className="text-sm text-gray-400">Loading...</p></div>
      ) : listings.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">Click &quot;Run Audit&quot; to check NAP consistency across directories.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {listings.some((l) => !l.is_consistent) && (
            <p className="px-5 py-2 text-[10px] text-gray-400 bg-gray-50 border-b border-gray-100">
              Note: Mismatches may be from post content, not your actual business name. Click the link to verify manually.
            </p>
          )}
          {listings.map((l) => (
            <div key={l.id} className={`px-5 py-3 ${!l.is_consistent ? 'bg-red-50/50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{l.directory}</span>
                  {l.listed_website && (
                    <a href={l.listed_website} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand hover:underline truncate max-w-[300px]">
                      View listing
                    </a>
                  )}
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${l.is_consistent ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {l.is_consistent ? 'Consistent' : l.issues?.includes('Not found in this directory') ? 'Not found' : 'Issues'}
                </span>
              </div>
              {l.listed_name && (
                <p className="text-xs text-gray-500 mt-0.5">Listed as: {l.listed_name}</p>
              )}
              {l.issues && l.issues.length > 0 && !l.issues.includes('Not found in this directory') && (
                <div className="mt-1">
                  {l.issues.map((issue, i) => (
                    <p key={i} className="text-xs text-red-600">• {issue}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
