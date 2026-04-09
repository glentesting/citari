'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'
import PageHeader from '@/components/layout/PageHeader'
import NarrativeGenerator from '@/components/reports/NarrativeGenerator'
import PRBrief from '@/components/reports/PRBrief'
import { formatDate } from '@/lib/utils'
import type { Report } from '@/types'

export default function ReportsPage() {
  const { activeClient } = useClient()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchReports = useCallback(async () => {
    if (!activeClient) {
      setReports([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('created_at', { ascending: false })

    setReports(data || [])
    setLoading(false)
  }, [activeClient])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  if (!activeClient) {
    return (
      <div>
        <PageHeader title="Reports" subtitle="Generate white-label PDF reports for your clients" />
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mt-6">
          <p className="text-sm text-gray-500">Select or add a client to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`${reports.length} report${reports.length !== 1 ? 's' : ''} for ${activeClient.name}`}
      />

      <div className="mt-6 space-y-6">
        <NarrativeGenerator />
        <PRBrief />

        {/* Report History */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-[2.5px] h-4 bg-brand rounded-full" />
            Report History
          </h3>

          {loading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <div className="w-12 h-12 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">No reports yet</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                Generate AI executive narratives above, or use the upcoming PDF report builder to create white-label client deliverables.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_100px_100px_80px] border-b border-gray-200 bg-gray-50">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Report</div>
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</div>
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</div>
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Pages</div>
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center"></div>
              </div>
              {reports.map((report) => (
                <div key={report.id} className="grid grid-cols-[1fr_120px_100px_100px_80px] border-b border-gray-100 last:border-b-0">
                  <div className="px-4 py-3 text-sm font-medium text-gray-900">{report.name}</div>
                  <div className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-brand-bg text-brand">
                      {report.report_type}
                    </span>
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-500">{formatDate(report.created_at)}</div>
                  <div className="px-4 py-3 text-sm text-gray-500 text-center">{report.page_count || '—'}</div>
                  <div className="px-4 py-3 flex items-center justify-center">
                    {report.pdf_url ? (
                      <a
                        href={report.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:text-brand-dark transition-colors"
                        title="Download PDF"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
