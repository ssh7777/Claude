'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/dashboard/Header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfidenceBadge } from '@/components/ConfidenceBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { CheckCircle, Download, ChevronLeft, Loader2, List, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Questionnaire, QuestionnaireItem } from '@/types'
import { createClient } from '@/lib/supabase/client'

export default function QuestionnairePage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
    const [items, setItems] = useState<QuestionnaireItem[]>([])
    const [selectedItem, setSelectedItem] = useState<QuestionnaireItem | null>(null)
    const [editedAnswer, setEditedAnswer] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [hasPendingSave, setHasPendingSave] = useState(false)
    const [mobileView, setMobileView] = useState<'list' | 'editor'>('list')

    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hasInitialized = useRef(false)

    const fetchData = useCallback(async (preserveSelection = false) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [{ data: q }, { data: qItems }] = await Promise.all([
            supabase.from('questionnaires').select('*').eq('id', id).eq('profile_id', user.id).single(),
            supabase.from('questionnaire_items').select('*').eq('questionnaire_id', id).order('row_number', { ascending: true }),
        ])

        if (q) setQuestionnaire(q)
        if (qItems) {
            setItems(qItems)
            if (!preserveSelection && !hasInitialized.current && qItems.length > 0) {
                hasInitialized.current = true
                setSelectedItem(qItems[0])
                setEditedAnswer(qItems[0].user_edited_answer ?? qItems[0].suggested_answer ?? '')
            }
        }
        setLoading(false)
    }, [id, supabase])

    useEffect(() => { fetchData() }, [fetchData])

    // Keyboard navigation
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLTextAreaElement) return
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                setItems(prev => {
                    const idx = prev.findIndex(i => i.id === selectedItem?.id)
                    const next = e.key === 'ArrowDown'
                        ? Math.min(idx + 1, prev.length - 1)
                        : Math.max(idx - 1, 0)
                    if (next !== idx) {
                        const nextItem = prev[next]
                        setSelectedItem(nextItem)
                        setEditedAnswer(nextItem.user_edited_answer ?? nextItem.suggested_answer ?? '')
                        setSaveSuccess(false)
                    }
                    return prev
                })
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [selectedItem?.id])

    // Warn on unsaved changes
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (hasPendingSave) {
                e.preventDefault()
                e.returnValue = ''
            }
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [hasPendingSave])

    const selectItem = (item: QuestionnaireItem) => {
        setSelectedItem(item)
        setEditedAnswer(item.user_edited_answer ?? item.suggested_answer ?? '')
        setSaveSuccess(false)
        setMobileView('editor')
    }

    const saveAnswer = async (answer: string, approved?: boolean) => {
        if (!selectedItem) return
        setSaving(true)
        setHasPendingSave(false)
        const body: { user_edited_answer?: string; is_approved?: boolean } = {}
        const baseline = selectedItem.user_edited_answer ?? selectedItem.suggested_answer ?? ''
        if (answer !== baseline) body.user_edited_answer = answer
        if (approved !== undefined) body.is_approved = approved

        if (Object.keys(body).length === 0) { setSaving(false); return }

        const res = await fetch(`/api/items/${selectedItem.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        if (res.ok) {
            const updated: QuestionnaireItem = await res.json()
            setSelectedItem(updated)
            setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 2000)
        }
        setSaving(false)
    }

    const handleAnswerChange = (val: string) => {
        setEditedAnswer(val)
        setHasPendingSave(true)
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(() => saveAnswer(val), 1500)
    }

    const handleApprove = async () => {
        await saveAnswer(editedAnswer, true)
        setItems(prev => {
            const idx = prev.findIndex(i => i.id === selectedItem?.id)
            if (idx < prev.length - 1) {
                const next = prev[idx + 1]
                setSelectedItem(next)
                setEditedAnswer(next.user_edited_answer ?? next.suggested_answer ?? '')
            }
            return prev
        })
    }

    const handleExport = async () => {
        setExporting(true)
        const res = await fetch(`/api/questionnaires/export?id=${id}`)
        if (res.ok) {
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') ?? 'export.xlsx'
            a.click()
            URL.revokeObjectURL(url)
        }
        setExporting(false)
    }

    const approvedCount = items.filter(i => i.is_approved).length
    const answeredCount = items.filter(i => ['answered', 'approved'].includes(i.status)).length
    const progressPct = items.length > 0 ? (approvedCount / items.length) * 100 : 0

    if (loading) {
        return (
            <div>
                <Header title="Loading..." />
                <div className="p-6 space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
            </div>
        )
    }

    if (!questionnaire) {
        return (
            <div>
                <Header title="Not Found" />
                <div className="p-6 text-muted-foreground">Questionnaire not found.</div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen">
            {/* Top toolbar */}
            <div className="flex-shrink-0 border-b border-border px-4 py-3 flex items-center gap-3 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => router.back()} aria-label="Go back">
                    <ChevronLeft className="h-4 w-4 mr-1" />Back
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="font-semibold text-sm truncate">{questionnaire.title}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Progress value={progressPct} className="h-1.5 w-24 sm:w-40" aria-label={`${approvedCount} of ${items.length} approved`} />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{approvedCount}/{items.length} approved</span>
                    </div>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">{answeredCount} answered · ↑↓ to navigate</span>
                <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting} aria-label="Export to Excel">
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="h-4 w-4 mr-1" />Export</>}
                </Button>
            </div>

            {/* Mobile tab switcher */}
            <div className="lg:hidden flex border-b border-border">
                <button
                    onClick={() => setMobileView('list')}
                    className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors', mobileView === 'list' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground')}
                    aria-label="Show question list"
                >
                    <List className="h-4 w-4" />Questions ({items.length})
                </button>
                <button
                    onClick={() => setMobileView('editor')}
                    className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors', mobileView === 'editor' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground')}
                    aria-label="Show answer editor"
                >
                    <Edit3 className="h-4 w-4" />Editor
                </button>
            </div>

            {/* Split layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: question list */}
                <div className={cn(
                    'w-full lg:w-80 xl:w-96 flex-shrink-0 border-r border-border overflow-y-auto',
                    mobileView === 'editor' ? 'hidden lg:block' : 'block'
                )}>
                    {items.map((item, idx) => (
                        <button
                            key={item.id}
                            onClick={() => selectItem(item)}
                            aria-label={`Question ${idx + 1}: ${item.question_text.substring(0, 80)}`}
                            aria-pressed={selectedItem?.id === item.id}
                            className={cn(
                                'w-full text-left flex items-start gap-2 px-3 py-3 cursor-pointer border-b border-border transition-colors hover:bg-muted/50',
                                selectedItem?.id === item.id && 'bg-primary/5 border-l-2 border-l-primary'
                            )}
                        >
                            <span className="text-xs text-muted-foreground w-6 flex-shrink-0 mt-0.5">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm line-clamp-2 text-left">{item.question_text}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <StatusBadge status={item.status} />
                                    {item.confidence_score !== null && (
                                        <ConfidenceBadge score={item.confidence_score} />
                                    )}
                                </div>
                            </div>
                            {item.is_approved && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" aria-label="Approved" />}
                        </button>
                    ))}
                </div>

                {/* Right: answer editor */}
                <div className={cn(
                    'flex-1 overflow-y-auto p-4 lg:p-6',
                    mobileView === 'list' ? 'hidden lg:block' : 'block'
                )}>
                    {!selectedItem ? (
                        <div className="text-center text-muted-foreground py-12">Select a question to review</div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-4">
                            <div className="rounded-lg bg-muted/50 border border-border p-4">
                                <p className="text-sm font-medium text-muted-foreground mb-1">Question {selectedItem.row_number}</p>
                                <p className="text-base font-medium">{selectedItem.question_text}</p>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                <StatusBadge status={selectedItem.status} />
                                <ConfidenceBadge score={selectedItem.confidence_score} />
                                {selectedItem.is_approved && (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                                        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />Approved
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="answer-editor" className="text-sm font-medium">Answer</label>
                                <Textarea
                                    id="answer-editor"
                                    value={editedAnswer}
                                    onChange={e => handleAnswerChange(e.target.value)}
                                    className="min-h-[180px] text-sm"
                                    placeholder="AI-generated answer will appear here..."
                                    aria-label="Edit answer"
                                />
                                <p className="text-xs text-muted-foreground" aria-live="polite">
                                    {saving ? 'Saving...' : saveSuccess ? '✓ Saved' : hasPendingSave ? 'Unsaved changes...' : 'Auto-saved as you type'}
                                </p>
                            </div>

                            <div className="flex gap-3 flex-wrap">
                                <Button
                                    variant="success"
                                    onClick={handleApprove}
                                    disabled={saving || selectedItem.is_approved}
                                    aria-label={selectedItem.is_approved ? 'Already approved' : 'Approve answer and go to next question'}
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                                    {selectedItem.is_approved ? 'Approved' : 'Approve & Next'}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => saveAnswer(editedAnswer)}
                                    disabled={saving}
                                    aria-label="Save answer"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Save'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="ml-auto"
                                    onClick={() => setMobileView('list')}
                                    aria-label="Back to question list"
                                >
                                    <List className="h-4 w-4 mr-1 lg:hidden" aria-hidden="true" />
                                    <span className="lg:hidden">All Questions</span>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
