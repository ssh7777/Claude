import { Sidebar } from '@/components/dashboard/Sidebar'
import { ThemeProvider } from '@/components/ThemeProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <div className="min-h-screen bg-background">
                <Sidebar />
                <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
                    {children}
                </main>
            </div>
        </ThemeProvider>
    )
}
