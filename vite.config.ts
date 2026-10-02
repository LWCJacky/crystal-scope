/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

/** Fontsource 的 CSS 同時引用 woff2 與 woff；現代瀏覽器皆支援 woff2，剔除 woff 可讓打包的字體檔減半。 */
const woff2Only = (): Plugin => ({
  name: 'fontsource-woff2-only',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('@fontsource') || !id.endsWith('.css')) return
    return code.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '')
  },
})

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

// GitHub Pages 子路徑：BASE_PATH=/crystal-scope/ npm run build
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [vue(), woff2Only()],
  // 版本與相依套件清單在建置時由 package.json 帶入，「關於」對話框據此列出使用的開源套件
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_DEPS__: JSON.stringify({ ...pkg.dependencies, ...pkg.devDependencies }),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
