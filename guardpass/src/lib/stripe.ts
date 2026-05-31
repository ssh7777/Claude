import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
    if (!_stripe) {
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: '2026-05-27.dahlia',
        })
    }
    return _stripe
}

export const PLANS = {
    free: {
        name: 'Free Trial',
        price: 0,
        questionnaires: 3,
        documents: 5,
        aiAnswers: 50,
    },
    professional: {
        name: 'Professional',
        price: 79,
        priceId: process.env.STRIPE_PRICE_PROFESSIONAL!,
        questionnaires: Infinity,
        documents: 50,
        aiAnswers: 500,
    },
    enterprise: {
        name: 'Enterprise',
        price: 299,
        priceId: process.env.STRIPE_PRICE_ENTERPRISE!,
        questionnaires: Infinity,
        documents: Infinity,
        aiAnswers: Infinity,
    },
}
