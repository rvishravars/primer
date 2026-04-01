import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['mermaid'],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      usePolling: true, // Enable polling for file changes in Docker
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  publicDir: 'public', // Explicitly set public directory
})
