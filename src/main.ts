import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
// 字體隨網站打包（Fontsource，SIL OFL 1.1），不依賴外部連線；
// Noto 只帶 400／700 兩個字重，各字集以 unicode-range 分段，瀏覽器只抓用到的部分
import '@fontsource-variable/nunito'
import '@fontsource/noto-sans-tc/400.css'
import '@fontsource/noto-sans-tc/700.css'
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/700.css'
import './style.css'

createApp(App).use(createPinia()).mount('#app')
