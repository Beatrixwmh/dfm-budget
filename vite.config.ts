import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Allow access through Cloudflare quick tunnels (*.trycloudflare.com) so the
    // app can be opened on a phone off the local network.
    allowedHosts: ['.trycloudflare.com'],
  },
})
