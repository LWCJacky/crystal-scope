# 安全更新紀錄（Security updates）

相依套件的已知漏洞（known vulnerabilities）修補紀錄。掃描報告 `SECURITY-REPORT.md` 由 SentinelOps 自動產生、含本機路徑，不納入版控（已列於 `.gitignore`）；每次依報告修補後，在此記下處理了哪些漏洞。

本專案部署為純靜態網站（`dist/`），下列套件皆為 devDependencies，只在本機 `npm run dev` 與 `npm test` 時載入，部署產物不受影響。

## 2026-10-28 — vite 8.3.2 → 8.3.5、vitest 4.1.11 → 4.1.12

依據 SentinelOps 2026-10-23 掃描（HIGH 1 · MEDIUM 6 · LOW 1）。修補後 `npm audit` 回報 0 個漏洞；142 項測試與正式建置通過。commit `e81f2d4`。

| 嚴重度 | 套件 | 編號 | 摘要 |
| --- | --- | --- | --- |
| HIGH | vite（內含 launch-editor） | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) / CVE-2026-112942 | `fs.existsSync()` 存在性檢查可在 Windows 上繞過 |
| MEDIUM | vite（內含 launch-editor） | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) / CVE-2026-112943 | `escapeCmdArgs()` 在 Windows 上漏掉 `%` 轉義 |
| MEDIUM | vite（內含 launch-editor） | [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) / CVE-2026-112944 | 編輯器 CLI 旗標誤判，部分編輯器可導致任意命令執行 |
| MEDIUM | vite | [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) / CVE-2026-112946 | 專案路徑與系統路徑相符時，`server.fs.allow` 以外的檔案可能被提供（非 Windows） |
| MEDIUM | vite | [GHSA-vfpm-58rq-9qcg](https://github.com/advisories/GHSA-vfpm-58rq-9qcg) / CVE-2026-112947 | `?vite-wasm-instance` 洩漏 `server.fs` 以外檔案的前 4 個位元組 |
| LOW | vite | [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) / CVE-2026-112945 | 透過 Vite 自訂 middleware 的跨來源腳本執行 |
| MEDIUM | @vitest/mocker（vitest 間接相依） | [GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp) / CVE-2026-112950 | Windows 反斜線路徑穿越繞過 redirect allowlist 修補 |
| MEDIUM | @vitest/mocker（vitest 間接相依） | [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) / CVE-2026-112949 | 未經驗證的 manual mock 註冊可導致程式碼注入 |

備註：本機 npm 10.9.9 在解析新版 vite 的 peer dependency 時會以 `Cannot read properties of null (reading 'edgesOut')` 中止，屬 npm 本身的問題；本次以 `npx npm@latest install -D vite@^8.3.3 vitest@^4.1.12` 完成安裝，lockfile 仍為第 3 版，npm 10 可正常讀取。
