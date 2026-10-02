import { onBeforeUnmount, ref } from 'vue'

/** 追蹤 CSS 媒體查詢（例如手機版面、觸控裝置）；以能力判斷，不嗅探 user agent。 */
export function useMediaQuery(query: string) {
  const mql = window.matchMedia(query)
  const matches = ref(mql.matches)
  const onChange = (e: MediaQueryListEvent) => (matches.value = e.matches)
  mql.addEventListener('change', onChange)
  onBeforeUnmount(() => mql.removeEventListener('change', onChange))
  return matches
}

/** 手機版面的分界，與 App.vue 的 CSS 一致。 */
export const MOBILE_QUERY = '(max-width: 860px)'
