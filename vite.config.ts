import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // the app shows an "update available" toast; no silent reloads mid-pitch
      includeAssets: ['brand/*', 'favicon.svg'],
      manifest: {
        name: 'BloomBox Pitch Arena',
        short_name: 'BloomBox',
        description: 'A virtual prediction game for BloomBox, the E-Cell of K. J. Somaiya College of Engineering.',
        theme_color: '#0a0f1e',
        background_color: '#0a0f1e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['education', 'entertainment'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Only the app shell is precached. Supabase API traffic is never cached, so balances can't go stale offline.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        maximumFileSizeToCacheInBytes: 3_000_000,
        runtimeCaching: [],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 900 },
  test: { include: ['tests/**/*.test.ts'] },
})
