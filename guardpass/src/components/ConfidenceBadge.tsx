import { cn } from '@/lib/utils'

interface ConfidenceBadgeProps {
    score: number | null
    className?: string
}

export function ConfidenceBadge({ score, className }: ConfidenceBadgeProps) {
    if (score === null || score === undefined) {
        return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', className)}>N/A</span>
    }

    const pct = Math.round(score * 100)

    let colorClass = ''
    let label = ''
    if (score >= 0.8) {
        colorClass = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
        label = `${pct}% High`
    } else if (score >= 0.5) {
        colorClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
        label = `${pct}% Medium`
    } else {
        colorClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        label = `${pct}% Low`
    }

    return (
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colorClass, className)}>
            {label}
        </span>
    )
}
