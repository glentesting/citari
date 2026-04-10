'use client'

import { useState, useEffect } from 'react'
import { onJobUpdate, getRunningJobs } from '@/lib/jobs'

interface Toast {
  id: string
  label: string
  status: 'running' | 'done' | 'error'
  error?: string
}

export default function BackgroundJobToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    // Initialize with any already-running jobs
    setToasts(getRunningJobs())

    const unsub = onJobUpdate((job) => {
      setToasts((prev) => {
        const existing = prev.find((t) => t.id === job.id)
        if (existing) {
          return prev.map((t) => t.id === job.id ? job : t)
        }
        return [...prev, job]
      })

      // Auto-remove completed/errored toasts after 5 seconds
      if (job.status === 'done' || job.status === 'error') {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== job.id))
        }, 5000)
      }
    })

    return unsub
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 transition-all duration-300 ${
            toast.status === 'running' ? 'bg-white border-gray-200' :
            toast.status === 'done' ? 'bg-green-50 border-green-200' :
            'bg-red-50 border-red-200'
          }`}
        >
          {toast.status === 'running' && (
            <svg className="w-4 h-4 text-brand animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {toast.status === 'done' && (
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          {toast.status === 'error' && (
            <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${
              toast.status === 'done' ? 'text-green-800' :
              toast.status === 'error' ? 'text-red-800' :
              'text-gray-900'
            }`}>
              {toast.status === 'done' ? `${toast.label} — complete` :
               toast.status === 'error' ? `${toast.label} — failed` :
               toast.label}
            </p>
            {toast.error && <p className="text-xs text-red-600 truncate">{toast.error}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
