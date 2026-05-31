'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Shield, LayoutDashboard, BookOpen, FileQuestion, CreditCard, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
    { href: '/questionnaires', label: 'Questionnaires', icon: FileQuestion },
    { href: '/billing', label: 'Billing', icon: CreditCard },
]

export function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const [mobileOpen, setMobileOpen] = useState(false)

    const handleSignOut = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    const SidebarContent = () => (
        <div className="flex h-full flex-col" style={{ background: 'var(--sidebar-bg)' }}>
            <div className="flex h-16 items-center gap-2 px-6 border-b border-white/10">
                <Shield className="h-7 w-7 text-blue-400" />
                <span className="text-xl font-bold text-white tracking-tight">GuardPass</span>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + '/')
                    return (
                        <Link
                            key={href}
                            href={href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                active
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            )}
                        >
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            {label}
                        </Link>
                    )
                })}
            </nav>

            <div className="border-t border-white/10 p-4">
                <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                    Sign Out
                </button>
            </div>
        </div>
    )

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50">
                <SidebarContent />
            </aside>

            {/* Mobile hamburger */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-16 items-center px-4 border-b border-border bg-background">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileOpen(true)}
                    className="mr-3"
                >
                    <Menu className="h-5 w-5" />
                </Button>
                <Shield className="h-6 w-6 text-blue-500 mr-2" />
                <span className="font-bold text-lg">GuardPass</span>
            </div>

            {/* Mobile drawer overlay */}
            {mobileOpen && (
                <div className="lg:hidden fixed inset-0 z-50 flex">
                    <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
                    <div className="relative w-64 flex-shrink-0">
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="absolute top-4 right-4 z-10 text-slate-400 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <SidebarContent />
                    </div>
                </div>
            )}
        </>
    )
}
