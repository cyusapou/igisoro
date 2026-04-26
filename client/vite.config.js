import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  // Allow VITE_SERVER_URL env variable to be injected at build time
  envPrefix: 'VITE_',
})
