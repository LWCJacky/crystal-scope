# CrystalScope｜晶體結構觀察室

以 Vue 建構的開源互動晶體結構觀察室：透過 3D 模型、晶胞動畫與參數控制，探索七大晶系及原子排列。

> 已完成：繁中／英／日三語介面（專業名詞附英文原文）、七大晶系與 14 種布拉菲晶格、10 個教學結構範例、晶格點／基元／結構三視圖、硬球模型與晶胞裁切、六方柱四軸與拼裝動畫、自動演示與導覽、尺度之旅（由 4 cm 的物件連續放大到晶胞）。尚未完成：原子分率座標編輯、晶胞參數編輯、晶向 [uvw] 介面（見方案 M1–M3）。實作方案見 [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)，概念規劃見 [`LatticeLab_Project_Plan.md`](LatticeLab_Project_Plan.md)。

## 開發

```bash
npm install
npm run dev     # 開發伺服器
npm test        # 幾何核心單元測試
npm run build   # 型別檢查 + 靜態建置
BASE_PATH=/crystal-scope/ npm run build   # GitHub Pages 子路徑
```

## 線上版本

GitHub Pages：<https://lwcjacky.com/crystal-scope/>（`lwcjacky.github.io/crystal-scope/` 會轉址到此）

> 首次部署前請到 GitHub → Settings → Pages，將 **Source** 設為 **GitHub Actions**；若仍是「Deploy from a branch」，Pages 會直接發布未建置的原始碼而無法運作。

推送到 `main` 分支會觸發 `.github/workflows/deploy.yml`：安裝相依、跑測試、以 `BASE_PATH=/crystal-scope/` 建置，再部署到 GitHub Pages（首次執行會自動啟用 Pages）。也可在 Actions 頁面手動觸發（workflow_dispatch）。

## 架構

| 目錄 | 責任 |
| --- | --- |
| `src/core/` | 幾何計算（純 TS）：晶胞驗證、基底矩陣、分率 ⇄ 直角座標、週期複製、晶向 |
| `src/data/` | 科學資料：七大晶系典型晶胞與晶胞設定說明 |
| `src/render/` | Three.js 渲染層（按需重繪、實例化球體） |
| `src/stores/` | Pinia：結構與歷史紀錄、介面設定 |
| `src/components/` | Vue 介面 |
| `src/i18n/` | 多語訊息表（zh-TW／en／ja）、專業名詞表與 `useI18n()` |

## 限制

球體大小與顏色為示意比例；晶胞邊線不代表化學鍵；自由編輯後的結構標示為「自訂結構」，不宣稱仍屬原晶系。

## 第三方資源

| 資源 | 用途 | 授權 |
| --- | --- | --- |
| [Nunito](https://fonts.google.com/specimen/Nunito)、[Noto Sans TC](https://fonts.google.com/noto/specimen/Noto+Sans+TC) | 介面字體（經 Google Fonts 載入；離線時退回系統字體） | SIL Open Font License 1.1 |
| [Three.js](https://threejs.org/) | 3D 渲染 | MIT |
| [Vue](https://vuejs.org/)、[Pinia](https://pinia.vuejs.org/) | 介面與狀態管理 | MIT |

## 授權

Copyright (C) 2026 LWCJacky

本專案（程式碼與教學內容）以 **GNU General Public License v3.0 或任何更新版本（GPL-3.0-or-later）** 授權。你可以自由使用、修改與散布，但衍生作品必須以相同授權開源並保留本聲明。完整條文見 [`LICENSE`](LICENSE)。

第三方資源各依其原授權：Three.js、Vue、Pinia 為 MIT，字體為 SIL OFL 1.1，皆與 GPL-3.0 相容。
