import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// HF serverless inference moved off api-inference.huggingface.co (410 Gone) to router.huggingface.co/hf-inference.
// Router does not allow browser CORS; proxy same-origin /hf-inference → https://router.huggingface.co/hf-inference
const hfInferenceProxy = {
  '/hf-inference': {
    target: 'https://router.huggingface.co',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: hfInferenceProxy,
  },
  preview: {
    proxy: hfInferenceProxy,
  },
})
