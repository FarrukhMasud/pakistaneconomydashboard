import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Chart.js and React change far less often than the dashboard code, so
        // isolating them keeps the cached vendor bundle stable across data
        // updates and pulls the entry chunk under the size warning.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](chart\.js|chartjs-|react-chartjs-2)/.test(id)) return 'vendor-charts';
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
})
