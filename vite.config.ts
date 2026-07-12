import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  // GitHub Pages serves from /dfm-budget/; local dev stays at root so
  // localhost and tunnel links keep working unchanged.
  base: command === 'build' ? '/dfm-budget/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    // Allow access through Cloudflare quick tunnels (*.trycloudflare.com) so the
    // app can be opened on a phone off the local network.
    allowedHosts: ['.trycloudflare.com'],
  },
}))
