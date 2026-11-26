import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // the in-browser image model (material recognition) loads its WebAssembly runtime itself; pre-bundling breaks it
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
})
