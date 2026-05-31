import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { priceId: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { priceId } = body
    if (!priceId) return NextResponse.json({ error: 'priceId is required' }, { status: 400 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id, company_name')
        .eq('id', user.id)
        .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
        const customer = await getStripe().customers.create({
            email: user.email,
            name: profile?.company_name || user.email,
            metadata: { supabase_user_id: user.id },
        })
        customerId = customer.id
        await supabase
            .from('profiles')
            .update({ stripe_customer_id: customerId })
            .eq('id', user.id)
    }

    const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
        metadata: { supabase_user_id: user.id },
    })

    return NextResponse.json({ url: session.url })
}
