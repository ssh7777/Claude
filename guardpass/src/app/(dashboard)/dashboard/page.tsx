import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/dashboard/Header'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { BookOpen, FileQuestion, CheckCircle, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [
        { count: docCount },
        { count: totalQ },
        { count: completedQ },
        { data: recentQ },
        { data: profile },
    ] = await Promise.all([
        supabase.from('knowledge_documents').select('*', { count: 'exact', head: true }).eq('profile_id', user!.id),
        supabase.from('questionnaires').select('*', { count: 'exact', head: true }).eq('profile_id', user!.id),
        supabase.from('questionnaires').select('*', { count: 'exact', head: true }).eq('profile_id', user!.id).eq('status', 'completed'),
        supabase.from('questionnaires').select('*').eq('profile_id', user!.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('profiles').select('company_name').eq('id', user!.id).single(),
    ])

    const approvalRate = totalQ && completedQ ? Math.round((completedQ / totalQ) * 100) : 0

    return (
        <div>
            <Header
                title={`Welcome back${profile?.company_name ? ', ' + profile.company_name : ''}`}
                subtitle="Your security compliance dashboard"
            />
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatsCard title="Knowledge Documents" value={docCount ?? 0} icon={BookOpen} description="Compliance docs uploaded" />
                    <StatsCard title="Total Questionnaires" value={totalQ ?? 0} icon={FileQuestion} description="All time" />
                    <StatsCard title="Completed" value={completedQ ?? 0} icon={CheckCircle} description="AI processing done" />
                    <StatsCard title="Completion Rate" value={`${approvalRate}%`} icon={TrendingUp} description="Questionnaires completed" />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Recent Questionnaires</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!recentQ || recentQ.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <FileQuestion className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p>No questionnaires yet.</p>
                                <Link href="/questionnaires" className="text-primary hover:underline text-sm mt-1 inline-block">Upload your first questionnaire →</Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {recentQ.map(q => (
                                    <Link key={q.id} href={`/questionnaires/${q.id}`} className="flex items-center justify-between py-3 hover:bg-muted/30 px-2 rounded-lg transition-colors">
                                        <div>
                                            <p className="font-medium text-sm">{q.title}</p>
                                            <p className="text-xs text-muted-foreground">{formatDate(q.created_at)} · {q.total_items} questions</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-muted-foreground">{q.completed_items}/{q.total_items}</span>
                                            <StatusBadge status={q.status} />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex gap-3">
                    <Link href="/knowledge-base" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 text-sm font-medium transition-colors">
                        <BookOpen className="h-4 w-4" />
                        Upload Document
                    </Link>
                    <Link href="/questionnaires" className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-accent h-10 px-4 py-2 text-sm font-medium transition-colors">
                        <FileQuestion className="h-4 w-4" />
                        New Questionnaire
                    </Link>
                </div>
            </div>
        </div>
    )
}
