import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, options) => {
          // Fallback to mock response if proxy fails
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error, serving mock token response')
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              client_secret: {
                value: 'mock-token-for-development'
              }
            }))
          })
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild'
  }
})