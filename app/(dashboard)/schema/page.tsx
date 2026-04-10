'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import PageHeader from '@/components/layout/PageHeader'

const schemaTypes = [
  { value: 'faq', label: 'FAQ', desc: 'A list of questions and answers — the most cited schema type by AI models', icon: '?' },
  { value: 'organization', label: 'Organization', desc: 'Your business name, logo, contact info — helps AI identify your brand', icon: '🏢' },
  { value: 'localbusiness', label: 'Local Business', desc: 'Your address, hours, location — critical for local search queries', icon: '📍' },
  { value: 'article', label: 'Article', desc: 'For blog posts and content pages — helps AI extract and cite your articles', icon: '📄' },
  { value: 'review', label: 'Review', desc: 'Aggregate star ratings and reviews — builds trust signals for AI', icon: '⭐' },
  { value: 'breadcrumb', label: 'Breadcrumb', desc: 'Page navigation hierarchy — helps AI understand site structure', icon: '🔗' },
]

interface SchemaItem {
  id: string
  schema_type: string
  page_url: string | null
  schema_json: any
  is_deployed: boolean
  created_at: string
}

interface AuditResult {
  url: string
  schemasFound: { type: string; valid: boolean }[]
  missing: string[]
  recommendations: string[]
}

export default function SchemaPage() {
  const { activeClient } = useClient()
  const [tab, setTab] = useState<'generate' | 'library' | 'audit'>('generate')
  const [selectedType, setSelectedType] = useState('faq')
  const [pageUrl, setPageUrl] = useState('')
  const [sourceContent, setSourceContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedSchema, setGeneratedSchema] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Library
  const [schemas, setSchemas] = useState<SchemaItem[]>([])
  const [loadingLib, setLoadingLib] = useState(true)

  // Audit
  const [infoOpen, setInfoOpen] = useState(false)
  const [auditing, setAuditing] = useState(false)
  const [auditScore, setAuditScore] = useState<number | null>(null)
  const [auditResults, setAuditResults] = useState<AuditResult[]>([])

  const supabase = createClient()

  const fetchSchemas = useCallback(async () => {
    if (!activeClient) { setSchemas([]); setLoadingLib(false); return }
    setLoadingLib(true)
    const { data } = await supabase
      .from('schema_markup')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('created_at', { ascending: false })
    setSchemas(data || [])
    setLoadingLib(false)
  }, [activeClient])

  useEffect(() => { fetchSchemas() }, [fetchSchemas])

  async function handleGenerate() {
    if (!activeClient) return
    setGenerating(true)
    setError(null)
    setGeneratedSchema(null)

    try {
      const res = await fetch('/api/schema/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: activeClient.id,
          schema_type: selectedType,
          page_url: pageUrl || undefined,
          source_content: sourceContent || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); } else {
        setGeneratedSchema(data.schema_json)
        fetchSchemas()
      }
    } catch { setError('Network error') }
    setGenerating(false)
  }

  async function handleAudit() {
    if (!activeClient?.domain) return
    setAuditing(true)
    setAuditScore(null)
    setAuditResults([])

    try {
      const res = await fetch('/api/schema/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: activeClient.domain }),
      })
      const data = await res.json()
      if (res.ok) {
        setAuditScore(data.score)
        setAuditResults(data.results)
      }
    } catch { /* */ }
    setAuditing(false)
  }

  async function toggleDeployed(id: string, current: boolean) {
    await supabase.from('schema_markup').update({ is_deployed: !current }).eq('id', id)
    fetchSchemas()
  }

  async function deleteSchema(id: string) {
    await supabase.from('schema_markup').delete().eq('id', id)
    fetchSchemas()
  }

  if (!activeClient) {
    return (
      <div>
        <PageHeader title="Schema Markup" subtitle="Generate and audit structured data for AI citation" />
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">Select or add a client to get started.</p>
        </div>
      </div>
    )
  }

  const scriptTag = generatedSchema
    ? `<script type="application/ld+json">\n${JSON.stringify(generatedSchema, null, 2)}\n</script>`
    : ''

  return (
    <div>
      <PageHeader title="Schema Markup" subtitle={`Structured data for ${activeClient.name} — invisible code that tells AI models what your business offers. AI cites businesses with proper schema 2.3x more often.`} />

      {/* What is Schema info box */}
      <div className="mt-4 bg-brand-bg border border-brand-border rounded-xl">
        <button
          onClick={() => setInfoOpen(!infoOpen)}
          className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-brand cursor-pointer"
        >
          What is Schema Markup?
          <svg
            className={`w-4 h-4 text-brand transition-transform ${infoOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {infoOpen && (
          <p className="px-5 pb-4 text-xs text-gray-600 leading-relaxed">
            Schema markup is invisible code added to your website that tells AI models and search engines exactly what your business offers. Businesses with proper schema are cited by AI models 2.3x more often. Generate the code here, then paste it into your website&apos;s &lt;head&gt; section or use a plugin like Yoast (WordPress) or RankMath.
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['generate', 'library', 'audit'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}>
            {t === 'generate' ? 'Generate' : t === 'library' ? `Library (${schemas.length})` : 'Audit'}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {/* Generate tab */}
        {tab === 'generate' && (
          <div className="grid grid-cols-[1fr_320px] gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Schema type</label>
                <div className="grid grid-cols-3 gap-2">
                  {schemaTypes.map((st) => (
                    <button key={st.value} onClick={() => setSelectedType(st.value)}
                      className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                        selectedType === st.value ? 'border-brand bg-brand-bg' : 'border-gray-200 hover:bg-gray-50'
                      }`}>
                      <span className="text-lg">{st.icon}</span>
                      <span className={`block text-sm font-medium mt-1 ${selectedType === st.value ? 'text-brand' : 'text-gray-900'}`}>
                        {st.label}
                      </span>
                      <span className="block text-xs text-gray-400 mt-0.5">{st.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page URL (optional)</label>
                <input type="url" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  placeholder={`https://${activeClient.domain || 'example.com'}/page`} />
              </div>

              {selectedType === 'faq' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source content (optional)</label>
                  <textarea value={sourceContent} onChange={(e) => setSourceContent(e.target.value)} rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                    placeholder="Paste content to extract Q&As from, or leave blank to use published GEO content" />
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button onClick={handleGenerate} disabled={generating}
                className="w-full py-3 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50 flex items-center justify-center gap-2">
                {generating ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Generating...</>
                ) : 'Generate Schema'}
              </button>

              {generatedSchema && (
                <div className="border-t border-gray-200 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">Generated JSON-LD</h4>
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(scriptTag)}
                        className="text-xs text-brand font-medium hover:underline">Copy script tag</button>
                      <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-gray-700">Test in Google</a>
                    </div>
                  </div>
                  <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto max-h-80">
                    {scriptTag}
                  </pre>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="space-y-4">
              <div className="bg-brand-bg border border-brand-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-brand mb-3">Why Schema Matters for AI</h3>
                <ul className="space-y-2 text-xs text-gray-700">
                  <li>AI models cite content with proper schema <strong>2.3x more often</strong></li>
                  <li>FAQ schema is the <strong>#1 most-cited</strong> schema type</li>
                  <li>Organization schema helps AI <strong>verify business identity</strong></li>
                  <li>LocalBusiness schema is <strong>critical for local AI queries</strong></li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">How to deploy</h3>
                <p className="text-xs text-gray-600">
                  Copy the generated script tag and paste it into the {'<head>'} section of your page, or use a schema plugin (Yoast, RankMath) to add it via your CMS.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Library tab */}
        {tab === 'library' && (
          <div>
            {loadingLib ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <p className="text-sm text-gray-400">Loading schemas...</p>
              </div>
            ) : schemas.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
                <h3 className="text-base font-semibold text-gray-900 mb-1">No schemas generated yet</h3>
                <p className="text-sm text-gray-500">Switch to the Generate tab to create your first schema markup.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {schemas.map((s) => (
                  <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-brand-bg text-brand">{s.schema_type}</span>
                        {s.page_url && <span className="text-xs text-gray-400 truncate max-w-xs">{s.page_url}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleDeployed(s.id, s.is_deployed)}
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            s.is_deployed ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {s.is_deployed ? 'Deployed' : 'Not deployed'}
                        </button>
                        <button onClick={() => navigator.clipboard.writeText(
                          `<script type="application/ld+json">\n${JSON.stringify(s.schema_json, null, 2)}\n</script>`
                        )} className="text-xs text-brand hover:underline">Copy</button>
                        <button onClick={() => deleteSchema(s.id)} className="text-gray-300 hover:text-red-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto max-h-32">
                      {JSON.stringify(s.schema_json, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit tab */}
        {tab === 'audit' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Schema Audit</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Crawl {activeClient.domain || 'your site'} to check for existing structured data.
                </p>
              </div>
              <button onClick={handleAudit} disabled={auditing || !activeClient.domain}
                className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50">
                {auditing ? 'Auditing...' : 'Run Audit'}
              </button>
            </div>

            {auditScore !== null && (
              <>
                <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Schema Health Score</p>
                  <p className={`text-4xl font-bold ${
                    auditScore >= 70 ? 'text-green-600' : auditScore >= 40 ? 'text-amber-600' : 'text-red-600'
                  }`}>{auditScore}/100</p>
                </div>

                {auditResults.map((r, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-gray-900 mb-2 truncate">{r.url}</p>
                    {r.schemasFound.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {r.schemasFound.map((s, j) => (
                          <span key={j} className={`px-2 py-0.5 text-xs rounded-full ${
                            s.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {s.type} {s.valid ? '✓' : '✗'}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.missing.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {r.missing.map((m, j) => (
                          <span key={j} className="px-2 py-0.5 text-xs rounded-full bg-red-50 text-red-600">Missing: {m}</span>
                        ))}
                      </div>
                    )}
                    {r.recommendations.map((rec, j) => (
                      <p key={j} className="text-xs text-gray-600 mt-1">• {rec}</p>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
