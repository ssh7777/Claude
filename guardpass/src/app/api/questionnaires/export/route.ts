import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildExportXLSX } from '@/lib/export'
import type { QuestionnaireItem } from '@/types'

export async function GET(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { data: questionnaire, error: qError } = await supabase
        .from('questionnaires')
        .select('*')
        .eq('id', id)
        .eq('profile_id', user.id)
        .single()

    if (qError || !questionnaire) {
        return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 })
    }

    const { data: items, error: itemsError } = await supabase
        .from('questionnaire_items')
        .select('*')
        .eq('questionnaire_id', id)
        .order('row_number', { ascending: true })

    if (itemsError) {
        return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    const buffer = buildExportXLSX(questionnaire.title, (items ?? []) as QuestionnaireItem[])
    const date = new Date().toISOString().split('T')[0]
    const filename = `guardpass-${questionnaire.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${date}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    })
}
