import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { user_edited_answer?: string; is_approved?: boolean }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { data: item, error: fetchError } = await supabase
        .from('questionnaire_items')
        .select('id, questionnaire_id')
        .eq('id', id)
        .single()

    if (fetchError || !item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const { data: questionnaire } = await supabase
        .from('questionnaires')
        .select('profile_id')
        .eq('id', item.questionnaire_id)
        .eq('profile_id', user.id)
        .single()

    if (!questionnaire) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}
    if (body.user_edited_answer !== undefined) updates.user_edited_answer = body.user_edited_answer
    if (body.is_approved !== undefined) {
        updates.is_approved = body.is_approved
        if (body.is_approved) updates.status = 'approved'
    }

    const { data: updated, error: updateError } = await supabase
        .from('questionnaire_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (updateError) {
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
    }

    return NextResponse.json(updated)
}
