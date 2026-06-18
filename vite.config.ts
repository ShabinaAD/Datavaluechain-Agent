import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` defaults to '/' for local dev and is overridden in CI (e.g. the
// GitHub Pages project path '/Datavaluechain-Agent/') via the BASE_PATH env var.
const base = process.env.BASE_PATH ?? '/'

// The API server (server/index.js) runs separately in dev; proxy /api to it so
// the frontend can use same-origin relative URLs in both dev and production.
const apiTarget = process.env.API_TARGET ?? 'http://localhost:8787'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
})
