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

/**
 * 啟動層：把 src/boot/boot.js 內嵌進 index.html（先於主程式執行）。
 * 建置時另把主程式的 <script src> 改為 data-main，由啟動層以 fetch 量測下載進度後再 import。
 */
const bootLayer = (): Plugin => ({
  name: 'crystalscope-boot-layer',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      const code = readFileSync(new URL('./src/boot/boot.js', import.meta.url), 'utf8')
      let out = html.replace('<!--BOOT_SCRIPT-->', `<script type="module">${code}</script>`)
      if (ctx.bundle) {
        // 主樣式表（含數百條 @font-face）不可阻擋首次繪製：以 media="print" 載入，完成後切為 all；
        // 啟動層會等它載入完成再啟動主程式，避免應用程式在無樣式狀態下閃現
        out = out.replace(
          /<link rel="stylesheet" crossorigin href="([^"]+)">/,
          '<link rel="stylesheet" crossorigin href="$1" media="print" data-main-css onload="this.media=\'all\';this.dataset.loaded=1">',
        )
        out = out.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, (_m, src: string) => {
          // fetch 串流得到的是解壓後的位元組，進度需以未壓縮大小為分母
          const file = src.split('/').pop() ?? ''
          const chunk = Object.values(ctx.bundle!).find((c) => c.fileName.endsWith(file))
          const size = chunk && 'code' in chunk ? Buffer.byteLength(chunk.code) : 0
          return `<script type="module" data-main="${src}" data-size="${size}"></script>`
        })
      }
      return out
    },
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
  plugins: [vue(), woff2Only(), bootLayer()],
  // 版本與相依套件清單在建置時由 package.json 帶入，「關於」對話框據此列出使用的開源套件
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_DEPS__: JSON.stringify({ ...pkg.dependencies, ...pkg.devDependencies }),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
