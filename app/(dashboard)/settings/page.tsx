'use client'

import { useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import PortalSettings from '@/components/settings/PortalSettings'
import ProfileTab from '@/components/settings/ProfileTab'
import WorkspaceModeTab from '@/components/settings/WorkspaceModeTab'
import WordPressConnection from '@/components/settings/WordPressConnection'
import CMSConnectionCard from '@/components/settings/CMSConnectionCard'
import BillingTab from '@/components/settings/BillingTab'
import NotificationsTab from '@/components/settings/NotificationsTab'

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
              <CMSConnectionCard
                platform="hubspot" name="HubSpot" desc="Push blog posts to HubSpot CMS"
                color="bg-orange-100" textColor="text-orange-600"
                connectEndpoint="/api/integrations/hubspot/connect"
                fields={[
                  { key: 'access_token', label: 'Private App Access Token', placeholder: 'pat-xxx-xxxxxxxx', type: 'password',
                    help: 'In HubSpot: Settings → Integrations → Private Apps → Create → copy the access token' },
                ]}
              />
              <CMSConnectionCard
                platform="webflow" name="Webflow" desc="Create items in Webflow CMS collections"
                color="bg-blue-100" textColor="text-blue-600"
                connectEndpoint="/api/integrations/webflow/connect"
                fields={[
                  { key: 'access_token', label: 'API Token', placeholder: 'your-webflow-api-token', type: 'password',
                    help: 'In Webflow: Account Settings → Integrations → API Access → Generate token' },
                ]}
              />
              <CMSConnectionCard
                platform="ghost" name="Ghost" desc="Publish posts via Ghost Admin API"
                color="bg-purple-100" textColor="text-purple-600"
                connectEndpoint="/api/integrations/ghost/connect"
                fields={[
                  { key: 'site_url', label: 'Ghost Site URL', placeholder: 'https://your-site.ghost.io' },
                  { key: 'admin_api_key', label: 'Admin API Key', placeholder: 'xxxxxxxxxxxx:yyyyyyyyyyyy', type: 'password',
                    help: 'In Ghost Admin: Settings → Integrations → Add custom integration → copy Admin API Key' },
                ]}
              />
              <CMSConnectionCard
                platform="shopify" name="Shopify" desc="Create blog articles in your Shopify store"
                color="bg-green-100" textColor="text-green-600"
                connectEndpoint="/api/integrations/shopify/connect"
                fields={[
                  { key: 'site_url', label: 'Store URL', placeholder: 'your-store.myshopify.com' },
                  { key: 'access_token', label: 'Admin API Access Token', placeholder: 'shpat_xxxxx', type: 'password',
                    help: 'In Shopify Admin: Settings → Apps → Develop apps → Create app → Admin API access token' },
                ]}
              />
              <CMSConnectionCard
                platform="godaddy" name="GoDaddy" desc="Domain management and DNS verification"
                color="bg-gray-100" textColor="text-gray-600"
                connectEndpoint="/api/integrations/godaddy/connect"
                fields={[
                  { key: 'api_key', label: 'API Key', placeholder: 'your-godaddy-api-key', type: 'password' },
                  { key: 'api_secret', label: 'API Secret', placeholder: 'your-godaddy-api-secret', type: 'password',
                    help: 'Get your API key at developer.godaddy.com → API Keys' },
                ]}
              />
            </div>
          )}

          {activeTab === 'notifications' && <NotificationsTab />}

          {activeTab === 'profile' && <ProfileTab />}
        </div>
      </div>
    </div>
  )
}
