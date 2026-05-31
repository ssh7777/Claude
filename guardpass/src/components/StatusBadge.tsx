import { cn } from '@/lib/utils'
import type { QuestionnaireStatus, ItemStatus } from '@/types'

interface StatusBadgeProps {
    status: QuestionnaireStatus | ItemStatus | string
    className?: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
    pending:    { label: 'Pending',    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
    processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse' },
    completed:  { label: 'Completed',  className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    failed:     { label: 'Failed',     className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    answered:   { label: 'Answered',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    approved:   { label: 'Approved',   className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    skipped:    { label: 'Skipped',    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' }
    return (
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className, className)}>
            {config.label}
        </span>
    )
}
