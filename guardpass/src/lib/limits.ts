import type { SupabaseClient } from '@supabase/supabase-js'

export const PLAN_LIMITS = {
    trialing: { questionnaires: 3, documents: 5, aiAnswers: 50 },
    active_professional: { questionnaires: Infinity, documents: 50, aiAnswers: 500 },
    active_enterprise: { questionnaires: Infinity, documents: Infinity, aiAnswers: Infinity },
}

const PROFESSIONAL_PRICE_ID = process.env.STRIPE_PRICE_PROFESSIONAL
const ENTERPRISE_PRICE_ID = process.env.STRIPE_PRICE_ENTERPRISE

function getLimits(status: string, priceId: string | null) {
    if (status === 'active') {
        if (priceId === ENTERPRISE_PRICE_ID) return PLAN_LIMITS.active_enterprise
        return PLAN_LIMITS.active_professional
    }
    return PLAN_LIMITS.trialing
}

export async function checkQuestionnaireLimit(
    supabase: SupabaseClient,
    userId: string
): Promise<{ allowed: boolean; message?: string }> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_subscription_status, stripe_price_id, ai_answers_this_month')
        .eq('id', userId)
        .single()

    if (!profile) return { allowed: false, message: 'Profile not found.' }

    const status = profile.stripe_subscription_status ?? 'trialing'
    if (!['trialing', 'active'].includes(status)) {
        return { allowed: false, message: 'An active subscription is required. Please upgrade your plan.' }
    }

    const limits = getLimits(status, profile.stripe_price_id)
    if (limits.questionnaires === Infinity) return { allowed: true }

    const { count } = await supabase
        .from('questionnaires')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', userId)

    if ((count ?? 0) >= limits.questionnaires) {
        return {
            allowed: false,
            message: `Your plan allows ${limits.questionnaires} questionnaire${limits.questionnaires !== 1 ? 's' : ''}. Upgrade to process more.`,
        }
    }

    return { allowed: true }
}

export async function checkDocumentLimit(
    supabase: SupabaseClient,
    userId: string
): Promise<{ allowed: boolean; message?: string }> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_subscription_status, stripe_price_id')
        .eq('id', userId)
        .single()

    if (!profile) return { allowed: false, message: 'Profile not found.' }

    const status = profile.stripe_subscription_status ?? 'trialing'
    if (!['trialing', 'active'].includes(status)) {
        return { allowed: false, message: 'An active subscription is required.' }
    }

    const limits = getLimits(status, profile.stripe_price_id)
    if (limits.documents === Infinity) return { allowed: true }

    const { count } = await supabase
        .from('knowledge_documents')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', userId)

    if ((count ?? 0) >= limits.documents) {
        return {
            allowed: false,
            message: `Your plan allows ${limits.documents} knowledge document${limits.documents !== 1 ? 's' : ''}. Upgrade to add more.`,
        }
    }

    return { allowed: true }
}

export async function checkAIAnswerLimit(
    supabase: SupabaseClient,
    userId: string,
    requestedCount: number
): Promise<{ allowed: boolean; remaining?: number; message?: string }> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_subscription_status, stripe_price_id, ai_answers_this_month')
        .eq('id', userId)
        .single()

    if (!profile) return { allowed: false, message: 'Profile not found.' }

    const status = profile.stripe_subscription_status ?? 'trialing'
    if (!['trialing', 'active'].includes(status)) {
        return { allowed: false, message: 'An active subscription is required.' }
    }

    const limits = getLimits(status, profile.stripe_price_id)
    if (limits.aiAnswers === Infinity) return { allowed: true }

    const used = profile.ai_answers_this_month ?? 0
    const remaining = limits.aiAnswers - used

    if (remaining <= 0) {
        return {
            allowed: false,
            remaining: 0,
            message: `You have used all ${limits.aiAnswers} AI answers for this billing period. Upgrade or wait for your period to reset.`,
        }
    }

    return { allowed: true, remaining }
}
