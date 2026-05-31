import { ThemeProvider } from '@/components/ThemeProvider'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            {children}
        </ThemeProvider>
    )
}
