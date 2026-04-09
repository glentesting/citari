'use client'

import { useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import PortalSettings from '@/components/settings/PortalSettings'

const tabs = [
  { id: 'portal', label: 'Client Portal' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'profile', label: 'Profile' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('portal')

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your workspace configuration" />

      <div className="mt-6 flex gap-6">
        {/* Tab navigation */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-brand-bg text-brand'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="flex-1">
          {activeTab === 'portal' && <PortalSettings />}

          {activeTab === 'integrations' && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-500">API integrations coming soon — Google Search Console, Serper.dev, and more.</p>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-500">Scan scheduling is managed via Vercel Cron. Daily scans run at 6 AM CT.</p>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-500">Email notifications are sent when visibility drops more than 5%. Configure alerts in your user settings.</p>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-500">Profile management coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
