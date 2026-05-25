import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Point Vite directly at the shared package's TS source so Rollup
      // never has to parse the CJS dist — avoids named-export detection
      // failures from the CommonJS plugin on Zod-heavy compiled output.
      '@uniconnect/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
})
