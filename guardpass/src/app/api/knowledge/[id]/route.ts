import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: doc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('storage_path')
        .eq('id', id)
        .eq('profile_id', user.id)
        .single()

    if (fetchError || !doc) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    await supabase.storage.from('knowledge-docs').remove([doc.storage_path])

    const { error: dbError } = await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', id)
        .eq('profile_id', user.id)

    if (dbError) {
        return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
