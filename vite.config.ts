/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

// GitHub Pages 子路徑：BASE_PATH=/crystal-scope/ npm run build
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [vue()],
  // 版本與相依套件清單在建置時由 package.json 帶入，「關於」對話框據此列出使用的開源套件
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_DEPS__: JSON.stringify({ ...pkg.dependencies, ...pkg.devDependencies }),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
