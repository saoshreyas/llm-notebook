import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Must match start.py / $PORT (default 8080). Use 127.0.0.1 to avoid
      // Windows localhost → ::1 ECONNREFUSED when uvicorn is IPv4-only.
      '/api': {
        target: `http://127.0.0.1:${process.env.NOTEBOOK_API_PORT || process.env.PORT || '8080'}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
