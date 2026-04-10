'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PLANS, type PlanId } from '@/lib/billing/stripe'

interface Subscription {
  plan: string
  status: string
  trial_ends_at: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
}

export default function BillingTab() {
  const supabase = createClient()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('subscriptions').select('*').limit(1).single()
        setSub(data)
      } catch (e) { console.error('Failed to load subscription:', e) }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleUpgrade(plan: PlanId) {
    setUpgrading(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setUpgrading(null)
    } catch (e) {
      console.error('Failed to initiate plan upgrade:', e)
      setUpgrading(null)
    }
  }

  async function handleManage() {
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (e) { console.error('Failed to open billing portal:', e) }
  }

  const currentPlan = (sub?.plan as PlanId) || 'starter'
  const isTrialing = sub?.status === 'trialing'
  const trialEnds = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null

  if (loading) {
    return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center"><p className="text-sm text-gray-400">Loading billing...</p></div>
  }

  return (
    <div className="space-y-6">
      {/* Current plan */}
      {sub && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Current Plan: <span className="text-brand">{PLANS[currentPlan]?.name || currentPlan}</span>
              </h3>
              {isTrialing && daysLeft !== null && (
                <p className="text-xs text-amber-600 mt-0.5">{daysLeft} days left in free trial</p>
              )}
              {sub.status === 'active' && sub.current_period_end && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Renews {new Date(sub.current_period_end).toLocaleDateString()}
                </p>
              )}
              {sub.status === 'cancelled' && (
                <p className="text-xs text-red-500 mt-0.5">Cancelled — access until period end</p>
              )}
              {sub.status === 'past_due' && (
                <p className="text-xs text-red-600 mt-0.5 font-medium">Payment failed — please update billing</p>
              )}
            </div>
            {sub.stripe_customer_id && (
              <button onClick={handleManage}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Manage Billing
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="grid grid-cols-3 gap-4">
        {(Object.entries(PLANS) as [PlanId, typeof PLANS[PlanId]][]).map(([id, plan]) => {
          const isCurrent = currentPlan === id
          return (
            <div key={id} className={`bg-white border rounded-xl p-5 ${
              id === 'professional' ? 'border-brand ring-1 ring-brand' : 'border-gray-200'
            }`}>
              {id === 'professional' && (
                <span className="inline-block px-2 py-0.5 text-[10px] font-bold text-white bg-brand rounded-full mb-3 uppercase tracking-wide">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                <span className="text-sm text-gray-500">/mo</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {plan.clients === -1 ? 'Unlimited' : plan.clients} clients · {plan.prompts === -1 ? 'Unlimited' : plan.prompts} prompts
              </p>

              <ul className="mt-4 space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !isCurrent && handleUpgrade(id)}
                disabled={isCurrent || upgrading !== null}
                className={`w-full mt-5 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-gray-100 text-gray-500 cursor-default'
                    : id === 'professional'
                    ? 'bg-brand text-white hover:bg-brand-dark disabled:opacity-50'
                    : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 disabled:opacity-50'
                }`}
              >
                {isCurrent ? 'Current Plan' : upgrading === id ? 'Redirecting...' : 'Upgrade'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
