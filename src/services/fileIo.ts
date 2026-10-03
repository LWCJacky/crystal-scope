/** 瀏覽器端檔案輸出入：只在使用者的裝置上進行，不經任何伺服器。 */

function download(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function downloadText(filename: string, text: string, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  download(url, filename)
  // 讓點擊有時間觸發再釋放
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  download(dataUrl, filename)
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsText(file)
  })
}

/** 檔名安全化：只留字母數字、底線、連字號。 */
export function safeFilename(name: string, fallback = 'crystalscope'): string {
  const cleaned = name.normalize('NFKD').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '')
  return cleaned || fallback
}
