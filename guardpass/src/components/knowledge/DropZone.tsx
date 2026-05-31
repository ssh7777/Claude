'use client'

import { useState, useRef, DragEvent } from 'react'
import { Upload, CloudUpload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DropZoneProps {
    onUpload: (file: File) => Promise<void>
    accept?: string
    maxSizeMB?: number
    loading?: boolean
}

export function DropZone({ onUpload, accept = '.pdf,.txt', maxSizeMB = 20, loading = false }: DropZoneProps) {
    const [dragging, setDragging] = useState(false)
    const [error, setError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const validateAndUpload = async (file: File) => {
        setError('')
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()
        const allowed = accept.split(',').map(s => s.trim())
        if (!allowed.includes(ext)) {
            setError(`Invalid file type. Allowed: ${accept}`)
            return
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`File too large. Maximum: ${maxSizeMB}MB`)
            return
        }
        await onUpload(file)
    }

    const onDrop = async (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) await validateAndUpload(file)
    }

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            await validateAndUpload(file)
            e.target.value = ''
        }
    }

    return (
        <div className="space-y-2">
            <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !loading && inputRef.current?.click()}
                className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                    dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
                    loading && 'opacity-60 cursor-not-allowed'
                )}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={onFileChange}
                    disabled={loading}
                />
                <div className="flex flex-col items-center gap-3">
                    {loading ? (
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    ) : (
                        <CloudUpload className="h-10 w-10 text-muted-foreground" />
                    )}
                    <div>
                        <p className="font-medium text-sm">
                            {loading ? 'Uploading...' : 'Drop files here or click to browse'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {accept.toUpperCase().replace(/\./g, '').replace(/,/g, ', ')} up to {maxSizeMB}MB
                        </p>
                    </div>
                    {!loading && (
                        <Button variant="outline" size="sm" type="button">
                            <Upload className="h-4 w-4 mr-2" />
                            Choose File
                        </Button>
                    )}
                </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    )
}
