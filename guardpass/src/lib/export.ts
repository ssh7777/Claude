import * as XLSX from 'xlsx'
import type { QuestionnaireItem } from '@/types'

export function buildExportXLSX(
    title: string,
    items: QuestionnaireItem[]
): Buffer {
    const rows = [
        ['Question', 'Answer', 'Confidence Score', 'Status'],
        ...items.map(item => [
            item.question_text,
            item.user_edited_answer ?? item.suggested_answer ?? '',
            item.confidence_score !== null ? (item.confidence_score * 100).toFixed(0) + '%' : 'N/A',
            item.status,
        ]),
    ]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)

    ws['!cols'] = [
        { wch: 60 },
        { wch: 80 },
        { wch: 18 },
        { wch: 14 },
    ]

    if (ws['A1']) ws['A1'].s = { font: { bold: true } }
    if (ws['B1']) ws['B1'].s = { font: { bold: true } }
    if (ws['C1']) ws['C1'].s = { font: { bold: true } }
    if (ws['D1']) ws['D1'].s = { font: { bold: true } }

    XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31))

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return Buffer.from(buf)
}
