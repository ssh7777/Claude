import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'GuardPass — AI Security Questionnaire Automation',
    description: 'Automate vendor security questionnaires with AI-powered compliance answers grounded in your documentation.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="antialiased">
                {children}
            </body>
        </html>
    )
}
