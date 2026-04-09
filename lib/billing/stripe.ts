import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any })
}

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 39,
    clients: 2,
    prompts: 50,
    features: ['Daily scans', 'Basic reports', 'Basic GEO content', 'Direct mode only'],
  },
  professional: {
    name: 'Professional',
    price: 89,
    clients: 10,
    prompts: 500,
    features: ['All scans + predictive alerts', 'White-label reports + client portal', 'Consultant mode', 'All CMS integrations', 'Schema generator'],
  },
  agency: {
    name: 'Agency',
    price: 199,
    clients: -1, // unlimited
    prompts: -1,
    features: ['Unlimited clients + prompts', 'All features including playbook', 'Competitive briefs + benchmarks', 'Priority support', 'Custom branding', 'Multilingual tracking'],
  },
} as const

export type PlanId = keyof typeof PLANS

export async function createCheckoutSession(
  workspaceId: string,
  plan: PlanId,
  customerEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const stripe = getStripe()
  const priceId = getPriceId(plan)

  // Find or create customer
  const customers = await stripe.customers.list({ email: customerEmail, limit: 1 })
  let customerId: string

  if (customers.data.length > 0) {
    customerId = customers.data[0].id
  } else {
    const customer = await stripe.customers.create({
      email: customerEmail,
      metadata: { workspace_id: workspaceId },
    })
    customerId = customer.id
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      trial_period_days: 14,
      metadata: { workspace_id: workspaceId, plan },
    },
    metadata: { workspace_id: workspaceId, plan },
  })

  return session.url!
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
  return session.url
}

function getPriceId(plan: PlanId): string {
  const priceIds: Record<PlanId, string> = {
    starter: process.env.STRIPE_STARTER_PRICE_ID || '',
    professional: process.env.STRIPE_PRO_PRICE_ID || '',
    agency: process.env.STRIPE_AGENCY_PRICE_ID || '',
  }
  const id = priceIds[plan]
  if (!id) throw new Error(`No Stripe price ID configured for plan: ${plan}`)
  return id
}

// Plan limit enforcement
export async function canAddClient(supabase: any, workspaceId: string): Promise<{ allowed: boolean; reason?: string }> {
  const sub = await getSubscription(supabase, workspaceId)
  const plan = PLANS[sub?.plan as PlanId] || PLANS.starter
  if (plan.clients === -1) return { allowed: true }

  const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
  if ((count || 0) >= plan.clients) {
    return { allowed: false, reason: `${plan.name} plan allows ${plan.clients} clients. Upgrade to add more.` }
  }
  return { allowed: true }
}

export async function canAddPrompt(supabase: any, workspaceId: string): Promise<{ allowed: boolean; reason?: string }> {
  const sub = await getSubscription(supabase, workspaceId)
  const plan = PLANS[sub?.plan as PlanId] || PLANS.starter
  if (plan.prompts === -1) return { allowed: true }

  const { data: clients } = await supabase.from('clients').select('id').eq('workspace_id', workspaceId)
  const clientIds = (clients || []).map((c: any) => c.id)
  if (clientIds.length === 0) return { allowed: true }

  const { count } = await supabase.from('prompts').select('id', { count: 'exact', head: true }).in('client_id', clientIds)
  if ((count || 0) >= plan.prompts) {
    return { allowed: false, reason: `${plan.name} plan allows ${plan.prompts} prompts. Upgrade to add more.` }
  }
  return { allowed: true }
}

async function getSubscription(supabase: any, workspaceId: string) {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, status, trial_ends_at')
    .eq('workspace_id', workspaceId)
    .single()

  if (!data) return { plan: 'starter', status: 'trialing' }

  // Check if trial expired
  if (data.status === 'trialing' && data.trial_ends_at && new Date(data.trial_ends_at) < new Date()) {
    return { ...data, status: 'expired' }
  }

  return data
}
