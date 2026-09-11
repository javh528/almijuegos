import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  build: {
    // No exponer source maps en producción (protege el código fuente)
    sourcemap: false,
    // Vite 8 usa OXC por defecto — eliminar console.* y debugger en producción
    target: 'es2020',
  },
  oxc: {
    // Drop console y debugger solo en el bundle de producción
    transform: {
      target: 'es2020',
    },
  },
})
