import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { resolve } from 'path'

let commitHash = 'unknown';
try { commitHash = execSync('git rev-parse --short HEAD').toString().trim(); } catch {}
if (commitHash === 'unknown' && process.env.CF_PAGES_COMMIT_SHA) commitHash = process.env.CF_PAGES_COMMIT_SHA.slice(0, 7);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(commitHash)
  },
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        hr: resolve(__dirname, 'hr.html'),
        inspect: resolve(__dirname, 'inspect.html'),
      },
    },
  }
})
