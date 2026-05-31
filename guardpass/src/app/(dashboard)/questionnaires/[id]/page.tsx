'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/dashboard/Header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfidenceBadge } from '@/components/ConfidenceBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { CheckCircle, Download, ChevronLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Questionnaire, QuestionnaireItem } from '@/types'
import { createClient } from '@/lib/supabase/client'

export default function QuestionnairePage() {
    const { id } = useParams<{ id: string }>()
    const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
    const [items, setItems] = useState<QuestionnaireItem[]>([])
    const [selectedItem, setSelectedItem] = useState<QuestionnaireItem | null>(null)
    const [editedAnswer, setEditedAnswer] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const supabase = createClient()
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const fetchData = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [{ data: q }, { data: qItems }] = await Promise.all([
            supabase.from('questionnaires').select('*').eq('id', id).eq('profile_id', user.id).single(),
            supabase.from('questionnaire_items').select('*').eq('questionnaire_id', id).order('row_number', { ascending: true }),
        ])

        if (q) setQuestionnaire(q)
        if (qItems) {
            setItems(qItems)
            if (!selectedItem && qItems.length > 0) {
                setSelectedItem(qItems[0])
                setEditedAnswer(qItems[0].user_edited_answer ?? qItems[0].suggested_answer ?? '')
            }
        }
        setLoading(false)
    }, [id, supabase, selectedItem])

    useEffect(() => { fetchData() }, [fetchData])

    const selectItem = (item: QuestionnaireItem) => {
        setSelectedItem(item)
        setEditedAnswer(item.user_edited_answer ?? item.suggested_answer ?? '')
        setSaveSuccess(false)
    }

    const saveAnswer = async (answer: string, approved?: boolean) => {
        if (!selectedItem) return
        setSaving(true)
        const body: { user_edited_answer?: string; is_approved?: boolean } = {}
        if (answer !== (selectedItem.user_edited_answer ?? selectedItem.suggested_answer ?? '')) {
            body.user_edited_answer = answer
        }
        if (approved !== undefined) body.is_approved = approved

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
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(() => saveAnswer(val), 1500)
    }

    const handleApprove = async () => {
        await saveAnswer(editedAnswer, true)
        const idx = items.findIndex(i => i.id === selectedItem?.id)
        if (idx < items.length - 1) selectItem(items[idx + 1])
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
                    {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
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
        <div className="flex flex-col h-screen lg:h-[calc(100vh-0px)]">
            {/* Top toolbar */}
            <div className="flex-shrink-0 border-b border-border px-4 py-3 flex items-center gap-3 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => history.back()}>
                    <ChevronLeft className="h-4 w-4 mr-1" />Back
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="font-semibold text-sm truncate">{questionnaire.title}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Progress value={progressPct} className="h-1.5 w-24 sm:w-40" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{approvedCount}/{items.length} approved</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{answeredCount} answered</span>
                </div>
                <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="h-4 w-4 mr-1" />Export</>}
                </Button>
            </div>

            {/* Split layout */}
            <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
                {/* Left: question list */}
                <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border overflow-y-auto max-h-48 lg:max-h-none">
                    {items.map((item, idx) => (
                        <div
                            key={item.id}
                            onClick={() => selectItem(item)}
                            className={cn(
                                'flex items-start gap-2 px-3 py-3 cursor-pointer border-b border-border transition-colors hover:bg-muted/50',
                                selectedItem?.id === item.id && 'bg-primary/5 border-l-2 border-l-primary'
                            )}
                        >
                            <span className="text-xs text-muted-foreground w-6 flex-shrink-0 mt-0.5">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm line-clamp-2">{item.question_text}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <StatusBadge status={item.status} className="text-xs" />
                                    {item.confidence_score !== null && (
                                        <ConfidenceBadge score={item.confidence_score} className="text-xs" />
                                    )}
                                </div>
                            </div>
                            {item.is_approved && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />}
                        </div>
                    ))}
                </div>

                {/* Right: answer editor */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {!selectedItem ? (
                        <div className="text-center text-muted-foreground py-12">Select a question to review</div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-4">
                            <div className="rounded-lg bg-muted/50 border border-border p-4">
                                <p className="text-sm font-medium text-muted-foreground mb-1">Question {selectedItem.row_number}</p>
                                <p className="text-base font-medium">{selectedItem.question_text}</p>
                            </div>

                            <div className="flex items-center gap-3">
                                <StatusBadge status={selectedItem.status} />
                                <ConfidenceBadge score={selectedItem.confidence_score} />
                                {selectedItem.is_approved && (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                                        <CheckCircle className="h-3.5 w-3.5" />Approved
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Answer</label>
                                <Textarea
                                    value={editedAnswer}
                                    onChange={e => handleAnswerChange(e.target.value)}
                                    className="min-h-[180px] text-sm"
                                    placeholder="AI-generated answer will appear here..."
                                />
                                <p className="text-xs text-muted-foreground">
                                    {saving ? 'Saving...' : saveSuccess ? '✓ Saved' : 'Auto-saved as you type'}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="success"
                                    onClick={handleApprove}
                                    disabled={saving || selectedItem.is_approved}
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    {selectedItem.is_approved ? 'Approved' : 'Approve & Next'}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => saveAnswer(editedAnswer)}
                                    disabled={saving}
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
