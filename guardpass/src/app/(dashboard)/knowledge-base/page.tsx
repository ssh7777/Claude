'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/dashboard/Header'
import { DropZone } from '@/components/knowledge/DropZone'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2, FileText, AlertCircle } from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'
import type { KnowledgeDocument } from '@/types'
import { createClient } from '@/lib/supabase/client'

export default function KnowledgeBasePage() {
    const [docs, setDocs] = useState<KnowledgeDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const fetchDocs = useCallback(async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
            .from('knowledge_documents')
            .select('*')
            .eq('profile_id', user.id)
            .order('created_at', { ascending: false })
        setDocs(data ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchDocs() }, [fetchDocs])

    const handleUpload = async (file: File) => {
        setUploading(true)
        setError('')
        setSuccess('')
        const formData = new FormData()
        formData.append('file', file)
        try {
            const res = await fetch('/api/knowledge/upload', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) { setError(data.error || 'Upload failed'); return }
            setSuccess(`"${data.file_name}" uploaded successfully (${data.token_count?.toLocaleString()} tokens)`)
            await fetchDocs()
        } catch {
            setError('Upload failed. Please try again.')
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (doc: KnowledgeDocument) => {
        if (!confirm(`Delete "${doc.file_name}"?`)) return
        setDeletingId(doc.id)
        try {
            const res = await fetch(`/api/knowledge/${doc.id}`, { method: 'DELETE' })
            if (res.ok) {
                setDocs(prev => prev.filter(d => d.id !== doc.id))
            }
        } finally {
            setDeletingId(null)
        }
    }

    const totalTokens = docs.reduce((sum, d) => sum + (d.token_count ?? 0), 0)
    const TOKEN_WARNING = 800000

    return (
        <div>
            <Header
                title="Knowledge Base"
                subtitle={`${docs.length} document${docs.length !== 1 ? 's' : ''} · ${totalTokens.toLocaleString()} tokens`}
            />
            <div className="p-6 space-y-6">
                {totalTokens > TOKEN_WARNING && (
                    <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                            Your knowledge base is approaching the AI context limit (~800,000 tokens). Consider removing older documents.
                        </p>
                    </div>
                )}

                {error && <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>}
                {success && <div className="rounded-md bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-300">{success}</div>}

                <DropZone onUpload={handleUpload} accept=".pdf,.txt" maxSizeMB={20} loading={uploading} />

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Uploaded Documents</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                            </div>
                        ) : docs.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No documents yet</p>
                                <p className="text-sm mt-1">Upload your SOC 2, ISO 27001, privacy policies, and other compliance documentation.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left py-3 px-2 font-medium text-muted-foreground">File Name</th>
                                            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                                            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden md:table-cell">Size</th>
                                            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden lg:table-cell">Tokens</th>
                                            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden lg:table-cell">Uploaded</th>
                                            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {docs.map(doc => (
                                            <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                                                <td className="py-3 px-2">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                        <span className="font-medium truncate max-w-[200px]">{doc.file_name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2 text-muted-foreground uppercase text-xs hidden sm:table-cell">{doc.file_type}</td>
                                                <td className="py-3 px-2 text-muted-foreground hidden md:table-cell">{doc.file_size ? formatBytes(doc.file_size) : 'N/A'}</td>
                                                <td className="py-3 px-2 text-muted-foreground hidden lg:table-cell">{doc.token_count?.toLocaleString() ?? 'N/A'}</td>
                                                <td className="py-3 px-2 text-muted-foreground hidden lg:table-cell">{formatDate(doc.created_at)}</td>
                                                <td className="py-3 px-2 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(doc)}
                                                        disabled={deletingId === doc.id}
                                                        className="text-muted-foreground hover:text-destructive h-8 w-8"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
