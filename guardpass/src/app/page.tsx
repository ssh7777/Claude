import Link from 'next/link'
import { Shield, Zap, FileCheck, Lock, ArrowRight, CheckCircle } from 'lucide-react'

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background">
            {/* Nav */}
            <nav className="border-b border-border px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
                <div className="flex items-center gap-2">
                    <Shield className="h-7 w-7 text-blue-500" />
                    <span className="text-xl font-bold">GuardPass</span>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
                    <Link href="/register" className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 text-sm font-medium transition-colors">
                        Get Started Free
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-1.5 text-sm text-blue-400 mb-8">
                    <Zap className="h-3.5 w-3.5" />
                    AI-Powered Compliance Automation
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
                    Answer Security Questionnaires<br />
                    <span className="text-blue-500">10x Faster with AI</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                    GuardPass ingests your compliance documentation and auto-generates authoritative, auditor-ready answers to vendor risk assessments — grounded strictly in your own policies.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 text-sm font-medium transition-colors">
                        Start Free Trial <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-accent h-11 px-8 text-sm font-medium transition-colors">
                        Sign In
                    </Link>
                </div>
            </section>

            {/* Features */}
            <section className="max-w-7xl mx-auto px-6 py-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { icon: FileCheck, title: 'Auto-Answer Questionnaires', desc: 'Upload XLSX/CSV vendor questionnaires and get AI-generated answers in minutes, not days.' },
                        { icon: Lock, title: 'Grounded in Your Docs', desc: 'Answers are based solely on your SOC 2, ISO 27001, and other compliance documentation — zero hallucination.' },
                        { icon: Shield, title: 'Audit-Ready Output', desc: 'Export completed questionnaires as formatted XLSX files ready for submission to auditors and procurement teams.' },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="rounded-xl border border-border bg-card p-6">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                <Icon className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="font-semibold text-lg mb-2">{title}</h3>
                            <p className="text-muted-foreground text-sm">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Pricing preview */}
            <section className="max-w-7xl mx-auto px-6 py-16 border-t border-border">
                <h2 className="text-3xl font-bold text-center mb-12">Simple, Transparent Pricing</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    {[
                        { name: 'Free Trial', price: '£0', features: ['3 questionnaires', '5 knowledge docs', '50 AI answers/month'] },
                        { name: 'Professional', price: '£79/mo', features: ['Unlimited questionnaires', '50 knowledge docs', '500 AI answers/month'], highlight: true },
                        { name: 'Enterprise', price: '£299/mo', features: ['Unlimited everything', 'White-label support', 'Priority support'] },
                    ].map(plan => (
                        <div key={plan.name} className={`rounded-xl border p-6 ${plan.highlight ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                            <h3 className="font-bold text-lg">{plan.name}</h3>
                            <p className="text-3xl font-bold mt-2 mb-4">{plan.price}</p>
                            <ul className="space-y-2">
                                {plan.features.map(f => (
                                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/register" className={`mt-6 w-full inline-flex items-center justify-center rounded-md h-10 text-sm font-medium transition-colors ${plan.highlight ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-input bg-background hover:bg-accent'}`}>
                                Get Started
                            </Link>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
                <p>© {new Date().getFullYear()} GuardPass. All rights reserved.</p>
            </footer>
        </div>
    )
}
