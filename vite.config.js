import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// In production (Vercel cleanUrls) /privacy and /terms resolve to their folders' index.html.
// The dev server only does that with a trailing slash, so mirror production here.
const legalRoutes = {
  name: 'legal-routes',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url || '').split('?')[0]
      if (path === '/privacy' || path === '/terms') req.url = `${path}/`
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), legalRoutes],
  server: {
    port: 5174,
  },
  build: {
    // The legal pages are real, separate HTML documents (not client-side routes) so that
    // /privacy and /terms resolve for crawlers and for Google's OAuth consent screen checks.
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy/index.html'),
        terms: resolve(import.meta.dirname, 'terms/index.html'),
      },
    },
  },
})
