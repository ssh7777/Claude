import * as XLSX from 'xlsx'

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const data = await pdfParse(buffer)
    return data.text
}

export function extractTextFromTXT(buffer: Buffer): string {
    return buffer.toString('utf-8')
}

export function extractQuestionsFromXLSX(buffer: Buffer): string[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

    if (data.length === 0) return []

    const headers = (data[0] as unknown[]).map(h => String(h ?? '').toLowerCase())
    let questionColIndex = headers.findIndex(h =>
        h === 'question' || h === 'questions' || h.includes('question')
    )
    if (questionColIndex === -1) questionColIndex = 0

    const questions: string[] = []
    for (let i = 1; i < data.length; i++) {
        const row = data[i] as unknown[]
        const val = row[questionColIndex]
        if (val !== undefined && val !== null && String(val).trim() !== '') {
            questions.push(String(val).trim())
        }
    }
    return questions
}

export function extractQuestionsFromCSV(buffer: Buffer): string[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

    if (data.length === 0) return []

    const headers = (data[0] as unknown[]).map(h => String(h ?? '').toLowerCase())
    let questionColIndex = headers.findIndex(h =>
        h === 'question' || h === 'questions' || h.includes('question')
    )
    if (questionColIndex === -1) questionColIndex = 0

    const questions: string[] = []
    for (let i = 1; i < data.length; i++) {
        const row = data[i] as unknown[]
        const val = row[questionColIndex]
        if (val !== undefined && val !== null && String(val).trim() !== '') {
            questions.push(String(val).trim())
        }
    }
    return questions
}
