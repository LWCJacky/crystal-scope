import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { bootFail, bootReport } from './boot/report'
// 字體隨網站打包（Fontsource，SIL OFL 1.1），不依賴外部連線；
// Noto 只帶 400／700 兩個字重，各字集以 unicode-range 分段，瀏覽器只抓用到的部分
import '@fontsource-variable/nunito'
import '@fontsource/noto-sans-tc/400.css'
import '@fontsource/noto-sans-tc/700.css'
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/700.css'
import './style.css'

const app = createApp(App).use(createPinia())
// 執行中未捕捉的錯誤：啟動完成前交給啟動層顯示；之後由 App 的提示條處理
app.config.errorHandler = (err) => {
  console.error(err)
  const message = err instanceof Error ? err.message : String(err)
  bootFail('runtime', message.slice(0, 120))
  window.dispatchEvent(new CustomEvent('cs:runtime-error', { detail: message }))
}
app.mount('#app')
bootReport('init')
