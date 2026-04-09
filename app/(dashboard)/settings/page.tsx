'use client'

import { useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import PortalSettings from '@/components/settings/PortalSettings'
import ProfileTab from '@/components/settings/ProfileTab'
import WorkspaceModeTab from '@/components/settings/WorkspaceModeTab'
import WordPressConnection from '@/components/settings/WordPressConnection'
import BillingTab from '@/components/settings/BillingTab'

const tabs = [
  { id: 'workspace', label: 'Workspace Mode' },
  { id: 'billing', label: 'Billing' },
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
          {activeTab === 'billing' && <BillingTab />}
          {activeTab === 'portal' && <PortalSettings />}

          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <WordPressConnection />
              {[
                { name: 'HubSpot', desc: 'Push blog posts to HubSpot CMS', color: 'bg-orange-100', textColor: 'text-orange-600' },
                { name: 'Webflow', desc: 'Create CMS items in Webflow collections', color: 'bg-blue-100', textColor: 'text-blue-600' },
                { name: 'Ghost', desc: 'Publish posts via Ghost Admin API', color: 'bg-purple-100', textColor: 'text-purple-600' },
                { name: 'Shopify', desc: 'Create blog articles in your Shopify store', color: 'bg-green-100', textColor: 'text-green-600' },
              ].map((cms) => (
                <div key={cms.name} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${cms.color} rounded-lg flex items-center justify-center`}>
                      <span className={`text-xs font-bold ${cms.textColor}`}>{cms.name[0]}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{cms.name}</h3>
                      <p className="text-xs text-gray-500">{cms.desc}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 text-xs font-medium text-gray-400 bg-gray-50 rounded-lg border border-gray-100">Coming soon</span>
                </div>
              ))}
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
