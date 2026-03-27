import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'version-file',
      closeBundle() {
        writeFileSync('dist/version.json', JSON.stringify({ buildTime: new Date().toISOString() }))
      },
    },
  ],
  base: '/dopadone-web/',
})
