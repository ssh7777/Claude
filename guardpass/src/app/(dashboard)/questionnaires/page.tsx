'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Progress } from '@/components/ui/progress'
import { Upload, Plus, FileQuestion, Loader2, Play } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Questionnaire } from '@/types'
import { createClient } from '@/lib/supabase/client'

export default function QuestionnairesPage() {
    const router = useRouter()
    const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [title, setTitle] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [processing, setProcessing] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [processError, setProcessError] = useState<string | null>(null)

    const fetchQuestionnaires = useCallback(async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
            .from('questionnaires')
            .select('*')
            .eq('profile_id', user.id)
            .order('created_at', { ascending: false })
        setQuestionnaires(data ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchQuestionnaires() }, [fetchQuestionnaires])

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file || !title.trim()) return
        setUploading(true)
        setError('')
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', title.trim())
        try {
            const res = await fetch('/api/questionnaires/upload', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) { setError(data.error || 'Upload failed'); return }
            setModalOpen(false)
            setTitle('')
            setFile(null)
            await fetchQuestionnaires()
        } catch {
            setError('Upload failed. Please try again.')
        } finally {
            setUploading(false)
        }
    }

    const handleProcess = async (q: Questionnaire) => {
        setProcessing(q.id)
        setProcessError(null)
        try {
            const res = await fetch('/api/questionnaires/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionnaire_id: q.id }),
            })
            if (res.status === 402) {
                setProcessError('Active subscription required. Please upgrade your plan.')
                return
            }
            await fetchQuestionnaires()
        } catch {
            setProcessError('Processing failed. Please try again.')
        } finally {
            setProcessing(null)
        }
    }

    return (
        <div>
            <Header title="Questionnaires" subtitle="Upload and process security questionnaires" />
            <div className="p-6 space-y-6">
                <div className="flex justify-end">
                    <Button onClick={() => { setModalOpen(true); setError('') }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Upload Questionnaire
                    </Button>
                </div>

                {processError && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{processError}</div>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">All Questionnaires</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                            </div>
                        ) : questionnaires.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <FileQuestion className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No questionnaires yet</p>
                                <p className="text-sm mt-1">Upload an XLSX or CSV file to get started.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Title</th>
                                            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                                            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden md:table-cell">Progress</th>
                                            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden lg:table-cell">Uploaded</th>
                                            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {questionnaires.map(q => (
                                            <tr
                                                key={q.id}
                                                className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                                                onClick={() => router.push(`/questionnaires/${q.id}`)}
                                            >
                                                <td className="py-3 px-2">
                                                    <p className="font-medium">{q.title}</p>
                                                    <p className="text-xs text-muted-foreground sm:hidden"><StatusBadge status={q.status} /></p>
                                                </td>
                                                <td className="py-3 px-2 hidden sm:table-cell">
                                                    <StatusBadge status={q.status} />
                                                </td>
                                                <td className="py-3 px-2 hidden md:table-cell">
                                                    <div className="flex items-center gap-2 min-w-[120px]">
                                                        <Progress value={q.total_items > 0 ? (q.completed_items / q.total_items) * 100 : 0} className="h-1.5 flex-1" />
                                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{q.completed_items}/{q.total_items}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2 text-muted-foreground hidden lg:table-cell">{formatDate(q.created_at)}</td>
                                                <td className="py-3 px-2 text-right" onClick={e => e.stopPropagation()}>
                                                    {q.status === 'pending' && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleProcess(q)}
                                                            disabled={processing === q.id}
                                                        >
                                                            {processing === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1" />Process</>}
                                                        </Button>
                                                    )}
                                                    {q.status === 'completed' && (
                                                        <Button size="sm" variant="outline" onClick={() => router.push(`/questionnaires/${q.id}`)}>
                                                            Review
                                                        </Button>
                                                    )}
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

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Questionnaire</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUpload} className="space-y-4">
                        {error && <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>}
                        <div className="space-y-2">
                            <Label htmlFor="q-title">Title</Label>
                            <Input
                                id="q-title"
                                placeholder="e.g. ACME Corp Security Assessment 2026"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="q-file">Questionnaire File (XLSX or CSV)</Label>
                            <Input
                                id="q-file"
                                type="file"
                                accept=".xlsx,.csv"
                                onChange={e => setFile(e.target.files?.[0] ?? null)}
                                required
                            />
                            <p className="text-xs text-muted-foreground">The file should have a column named "Question" or questions in column A.</p>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={uploading || !file}>
                                {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload</>}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
