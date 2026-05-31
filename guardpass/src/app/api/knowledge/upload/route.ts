import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractTextFromPDF, extractTextFromTXT } from '@/lib/parsers'
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
    if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const allowedTypes = ['application/pdf', 'text/plain']
    const allowedExtensions = ['.pdf', '.txt']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
        return NextResponse.json({ error: 'Invalid file type. Only PDF and TXT files are allowed.' }, { status: 400 })
    }

    const MAX_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: 'File too large. Maximum size is 20MB.' }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let parsedText = ''
    const fileType = file.type === 'application/pdf' || ext === '.pdf' ? 'pdf' : 'txt'

    try {
        if (fileType === 'pdf') {
            parsedText = await extractTextFromPDF(buffer)
        } else {
            parsedText = extractTextFromTXT(buffer)
        }
    } catch {
        return NextResponse.json({ error: 'Failed to parse file content.' }, { status: 500 })
    }

    const fileId = randomUUID()
    const storagePath = `${user.id}/${fileId}-${file.name}`

    const { error: storageError } = await supabase.storage
        .from('knowledge-docs')
        .upload(storagePath, buffer, { contentType: file.type })

    if (storageError) {
        return NextResponse.json({ error: 'Failed to upload file to storage.' }, { status: 500 })
    }

    const tokenCount = Math.ceil(parsedText.length / 4)

    const { data: doc, error: dbError } = await supabase
        .from('knowledge_documents')
        .insert({
            profile_id: user.id,
            file_name: file.name,
            file_size: file.size,
            file_type: fileType,
            storage_path: storagePath,
            parsed_text: parsedText,
            token_count: tokenCount,
        })
        .select()
        .single()

    if (dbError) {
        await supabase.storage.from('knowledge-docs').remove([storagePath])
        return NextResponse.json({ error: 'Failed to save document record.' }, { status: 500 })
    }

    return NextResponse.json({
        id: doc.id,
        file_name: doc.file_name,
        token_count: doc.token_count,
    })
}
