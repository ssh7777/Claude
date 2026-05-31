'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle, Loader2, CreditCard, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Profile } from '@/types'
import { createClient } from '@/lib/supabase/client'

const PLANS = [
    {
        id: 'free',
        name: 'Free Trial',
        price: 0,
        period: null,
        features: ['3 questionnaires', '5 knowledge documents', '50 AI answers/month', 'XLSX export'],
        priceEnvKey: null as string | null,
        highlight: false,
    },
    {
        id: 'professional',
        name: 'Professional',
        price: 79,
        period: '/month',
        features: ['Unlimited questionnaires', '50 knowledge documents', '500 AI answers/month', 'XLSX export', 'Priority processing'],
        priceEnvKey: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL ?? null,
        highlight: true,
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 299,
        period: '/month',
        features: ['Unlimited everything', 'Unlimited knowledge documents', 'Unlimited AI answers', 'White-label support', 'Priority support', 'Custom integrations'],
        priceEnvKey: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE ?? null,
        highlight: false,
    },
]

export default function BillingPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    const fetchProfile = useCallback(async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(data)
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchProfile()
        // Handle Stripe redirect back
        const params = new URLSearchParams(window.location.search)
        if (params.get('success')) setSuccessMsg('Subscription activated successfully! Welcome to your new plan.')
        if (params.get('canceled')) setErrorMsg('Checkout canceled. You have not been charged.')
    }, [fetchProfile])

    const handleUpgrade = async (priceEnvKey: string) => {
        setCheckoutLoading(priceEnvKey)
        setErrorMsg('')
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priceId: priceEnvKey }),
            })
            const data = await res.json()
            if (!res.ok) { setErrorMsg(data.error || 'Checkout failed'); return }
            if (data.url) window.location.href = data.url
        } catch {
            setErrorMsg('Failed to start checkout. Please try again.')
        } finally {
            setCheckoutLoading(null)
        }
    }

    const currentStatus = profile?.stripe_subscription_status ?? 'trialing'
    const isActive = ['trialing', 'active'].includes(currentStatus)

    const statusConfig: Record<string, { label: string; className: string }> = {
        trialing: { label: 'Free Trial', className: 'text-blue-600 dark:text-blue-400' },
        active:   { label: 'Active',     className: 'text-green-600 dark:text-green-400' },
        past_due: { label: 'Past Due',   className: 'text-amber-600 dark:text-amber-400' },
        canceled: { label: 'Canceled',   className: 'text-red-600 dark:text-red-400' },
        inactive: { label: 'Inactive',   className: 'text-gray-600 dark:text-gray-400' },
    }
    const statusInfo = statusConfig[currentStatus] ?? statusConfig.inactive

    return (
        <div>
            <Header title="Billing & Plans" subtitle="Manage your subscription" />
            <div className="p-6 space-y-6 max-w-5xl">
                {successMsg && (
                    <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 px-4 py-3">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <p className="text-sm text-green-800 dark:text-green-300">{successMsg}</p>
                    </div>
                )}
                {errorMsg && (
                    <div className="flex items-center gap-3 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                        <p className="text-sm text-destructive">{errorMsg}</p>
                    </div>
                )}

                {/* Current plan summary */}
                {loading ? (
                    <Skeleton className="h-28 w-full rounded-xl" />
                ) : (
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between flex-wrap gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Current Plan</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <CreditCard className="h-5 w-5 text-primary" />
                                        <span className="text-xl font-bold">
                                            {currentStatus === 'trialing' ? 'Free Trial' : 'Paid Plan'}
                                        </span>
                                        <span className={`text-sm font-medium ${statusInfo.className}`}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                    {profile?.current_period_end && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {currentStatus === 'active' ? 'Renews' : 'Expires'}: {formatDate(profile.current_period_end)}
                                        </p>
                                    )}
                                </div>
                                {!isActive && (
                                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 px-3 py-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                        <span className="text-sm text-amber-800 dark:text-amber-300">Subscription inactive — upgrade to continue processing.</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Pricing cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {PLANS.map(plan => {
                        const isCurrent = currentStatus === 'trialing' && plan.id === 'free'

                        return (
                            <Card key={plan.id} className={plan.highlight ? 'border-primary ring-1 ring-primary' : ''}>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>{plan.name}</CardTitle>
                                        {isCurrent && (
                                            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">Current</span>
                                        )}
                                        {plan.highlight && (
                                            <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Popular</span>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-1 mt-2">
                                        <span className="text-3xl font-bold">£{plan.price}</span>
                                        {plan.period && <span className="text-muted-foreground text-sm">{plan.period}</span>}
                                    </div>
                                    <CardDescription className="mt-1">
                                        {plan.id === 'free' && 'Get started with no commitment'}
                                        {plan.id === 'professional' && 'For teams processing regular vendor assessments'}
                                        {plan.id === 'enterprise' && 'For organisations with high-volume compliance needs'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2.5 mb-6">
                                        {plan.features.map(f => (
                                            <li key={f} className="flex items-start gap-2 text-sm">
                                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    {plan.id === 'free' ? (
                                        <Button variant="outline" className="w-full" disabled>
                                            {isCurrent ? 'Current Plan' : 'Free Tier'}
                                        </Button>
                                    ) : (
                                        <Button
                                            className="w-full"
                                            variant={plan.highlight ? 'default' : 'outline'}
                                            onClick={() => {
                                                if (!plan.priceEnvKey) return
                                                handleUpgrade(plan.priceEnvKey)
                                            }}
                                            disabled={!!checkoutLoading || !plan.priceEnvKey}
                                        >
                                            {checkoutLoading === plan.priceEnvKey
                                                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading...</>
                                                : `Upgrade to ${plan.name}`
                                            }
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                    All prices in GBP. Subscriptions billed monthly. Cancel anytime.
                </p>
            </div>
        </div>
    )
}
