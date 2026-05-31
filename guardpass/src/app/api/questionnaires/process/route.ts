import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAnswer } from '@/lib/gemini'

export const maxDuration = 300

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { questionnaire_id: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { questionnaire_id } = body
    if (!questionnaire_id) {
        return NextResponse.json({ error: 'questionnaire_id is required' }, { status: 400 })
    }

    const { data: questionnaire, error: qError } = await supabase
        .from('questionnaires')
        .select('*')
        .eq('id', questionnaire_id)
        .eq('profile_id', user.id)
        .single()

    if (qError || !questionnaire) {
        return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_subscription_status, ai_answers_this_month, stripe_price_id')
        .eq('id', user.id)
        .single()

    const status = profile?.stripe_subscription_status ?? 'trialing'
    if (!['trialing', 'active'].includes(status)) {
        return NextResponse.json({ error: 'Active subscription required to process questionnaires.' }, { status: 402 })
    }

    await supabase
        .from('questionnaires')
        .update({ status: 'processing' })
        .eq('id', questionnaire_id)

    const { data: docs } = await supabase
        .from('knowledge_documents')
        .select('parsed_text')
        .eq('profile_id', user.id)

    const knowledgeContext = docs?.map(d => d.parsed_text).filter(Boolean).join('\n\n---\n\n') ?? ''

    const { data: items } = await supabase
        .from('questionnaire_items')
        .select('*')
        .eq('questionnaire_id', questionnaire_id)
        .eq('status', 'pending')
        .order('row_number', { ascending: true })

    if (!items || items.length === 0) {
        await supabase.from('questionnaires').update({ status: 'completed' }).eq('id', questionnaire_id)
        return NextResponse.json({ questionnaire_id, completed_items: 0 })
    }

    const BATCH_SIZE = 10
    let completedCount = questionnaire.completed_items || 0

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE)

        for (const item of batch) {
            await supabase
                .from('questionnaire_items')
                .update({ status: 'processing' })
                .eq('id', item.id)

            try {
                const result = await generateAnswer(knowledgeContext, item.question_text)
                await supabase
                    .from('questionnaire_items')
                    .update({
                        suggested_answer: result.suggested_answer,
                        confidence_score: result.confidence_score,
                        status: 'answered',
                    })
                    .eq('id', item.id)
            } catch {
                await supabase
                    .from('questionnaire_items')
                    .update({ status: 'answered', suggested_answer: 'Processing failed. Please retry.', confidence_score: 0 })
                    .eq('id', item.id)
            }

            completedCount++
            await supabase
                .from('questionnaires')
                .update({ completed_items: completedCount })
                .eq('id', questionnaire_id)
        }

        if (i + BATCH_SIZE < items.length) {
            await sleep(1000)
        }
    }

    await supabase
        .from('questionnaires')
        .update({ status: 'completed' })
        .eq('id', questionnaire_id)

    await supabase
        .from('profiles')
        .update({ ai_answers_this_month: (profile?.ai_answers_this_month ?? 0) + items.length })
        .eq('id', user.id)

    return NextResponse.json({ questionnaire_id, completed_items: completedCount })
}
