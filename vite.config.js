import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' -> works on any GitHub Pages sub-path (e.g. /25h2/)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
})
