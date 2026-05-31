import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '25mb',
        },
    },
    turbopack: {
        resolveAlias: {
            canvas: { browser: './src/lib/canvas-mock.ts' },
        },
    },
}

export default nextConfig
