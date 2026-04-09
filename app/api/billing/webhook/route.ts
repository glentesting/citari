import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' as any })
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (e: any) {
    return NextResponse.json({ error: `Webhook error: ${e.message}` }, { status: 400 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const workspaceId = session.metadata?.workspace_id
      const plan = session.metadata?.plan || 'starter'

      if (workspaceId && session.subscription) {
        const subscription = await getStripe().subscriptions.retrieve(session.subscription as string) as any

        await supabase.from('subscriptions').upsert({
          workspace_id: workspaceId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          plan,
          status: subscription.status === 'trialing' ? 'trialing' : 'active',
          trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        }, { onConflict: 'workspace_id' })
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as any
      const workspaceId = subscription.metadata?.workspace_id

      if (workspaceId) {
        const plan = subscription.metadata?.plan || 'starter'
        await supabase.from('subscriptions').update({
          plan,
          status: subscription.cancel_at_period_end ? 'cancelled' : subscription.status === 'trialing' ? 'trialing' : 'active',
          current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        }).eq('workspace_id', workspaceId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const workspaceId = subscription.metadata?.workspace_id

      if (workspaceId) {
        await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('workspace_id', workspaceId)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as any
      const subId = invoice.subscription as string
      if (subId) {
        await supabase.from('subscriptions').update({ status: 'past_due' }).eq('stripe_subscription_id', subId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
