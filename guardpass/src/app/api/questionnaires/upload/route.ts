import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractQuestionsFromXLSX, extractQuestionsFromCSV } from '@/lib/parsers'
import { randomUUID } from 'crypto'

export const maxDuration = 60

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let formData: FormData
    try {
        formData = await request.formData()
    } catch {
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!['.xlsx', '.csv'].includes(ext)) {
        return NextResponse.json({ error: 'Invalid file type. Only XLSX and CSV files are allowed.' }, { status: 400 })
    }

    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let questions: string[]

    try {
        questions = ext === '.csv'
            ? extractQuestionsFromCSV(buffer)
            : extractQuestionsFromXLSX(buffer)
    } catch {
        return NextResponse.json({ error: 'Failed to parse questionnaire file.' }, { status: 500 })
    }

    if (questions.length === 0) {
        return NextResponse.json({ error: 'No questions found in the file.' }, { status: 400 })
    }

    const fileId = randomUUID()
    const storagePath = `${user.id}/${fileId}-${file.name}`

    await supabase.storage.from('questionnaires').upload(storagePath, buffer)

    const { data: questionnaire, error: qError } = await supabase
        .from('questionnaires')
        .insert({
            profile_id: user.id,
            title: title.trim(),
            original_filename: file.name,
            status: 'pending',
            total_items: questions.length,
            completed_items: 0,
        })
        .select()
        .single()

    if (qError || !questionnaire) {
        return NextResponse.json({ error: 'Failed to create questionnaire.' }, { status: 500 })
    }

    const items = questions.map((q, i) => ({
        questionnaire_id: questionnaire.id,
        row_number: i + 1,
        question_text: q,
        status: 'pending',
    }))

    const { error: itemsError } = await supabase
        .from('questionnaire_items')
        .insert(items)

    if (itemsError) {
        await supabase.from('questionnaires').delete().eq('id', questionnaire.id)
        return NextResponse.json({ error: 'Failed to save questions.' }, { status: 500 })
    }

    return NextResponse.json({ questionnaire_id: questionnaire.id, total_items: questions.length })
}
