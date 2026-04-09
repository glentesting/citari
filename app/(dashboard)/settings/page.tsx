'use client'

import { useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import PortalSettings from '@/components/settings/PortalSettings'
import ProfileTab from '@/components/settings/ProfileTab'
import WorkspaceModeTab from '@/components/settings/WorkspaceModeTab'
import WordPressConnection from '@/components/settings/WordPressConnection'

const tabs = [
  { id: 'workspace', label: 'Workspace Mode' },
  { id: 'portal', label: 'Client Portal' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'profile', label: 'Profile' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('workspace')

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your workspace configuration" />

      <div className="mt-6 flex gap-6">
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

        <div className="flex-1">
          {activeTab === 'workspace' && <WorkspaceModeTab />}
          {activeTab === 'portal' && <PortalSettings />}

          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <WordPressConnection />
              <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
                <p className="text-xs text-gray-400">More integrations coming: Webflow, HubSpot, Ghost, Shopify</p>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-500">
                Email notifications are sent when visibility drops more than 5%.
                {' '}In Consultant Mode, alerts include strategic context and action recommendations.
                {' '}In Direct Mode, alerts are in plain English with simple next steps.
              </p>
            </div>
          )}

          {activeTab === 'profile' && <ProfileTab />}
        </div>
      </div>
    </div>
  )
}
