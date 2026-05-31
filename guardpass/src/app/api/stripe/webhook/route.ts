import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import type Stripe from 'stripe'

function createAdminClient() {
    return createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function POST(request: NextRequest) {
    const body = await request.text()
    const sig = request.headers.get('stripe-signature')!

    let event: Stripe.Event
    try {
        event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }

    const supabase = createAdminClient()

    switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
            const sub = event.data.object as Stripe.Subscription
            const customerId = sub.customer as string
            await supabase
                .from('profiles')
                .update({
                    stripe_subscription_id: sub.id,
                    stripe_subscription_status: sub.status,
                    stripe_price_id: sub.items.data[0]?.price.id ?? null,
                    current_period_end: sub.items.data[0]?.current_period_end
                        ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
                        : null,
                })
                .eq('stripe_customer_id', customerId)
            break
        }
        case 'customer.subscription.deleted': {
            const sub = event.data.object as Stripe.Subscription
            const customerId = sub.customer as string
            await supabase
                .from('profiles')
                .update({
                    stripe_subscription_status: 'canceled',
                    stripe_subscription_id: null,
                })
                .eq('stripe_customer_id', customerId)
            break
        }
        case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice
            const customerId = invoice.customer as string
            await supabase
                .from('profiles')
                .update({ stripe_subscription_status: 'past_due' })
                .eq('stripe_customer_id', customerId)
            break
        }
        case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice
            const customerId = invoice.customer as string
            await supabase
                .from('profiles')
                .update({
                    stripe_subscription_status: 'active',
                    ai_answers_this_month: 0,
                })
                .eq('stripe_customer_id', customerId)
            break
        }
    }

    return NextResponse.json({ received: true })
}
