/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// GitHub Pages 子路徑：BASE_PATH=/crystal-scope/ npm run build
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [vue()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
