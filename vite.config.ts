import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` defaults to '/' for local dev and is overridden in CI (e.g. the
// GitHub Pages project path '/Datavaluechain-Agent/') via the BASE_PATH env var.
const base = process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
