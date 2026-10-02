# CrystalScope｜晶體結構觀察室

以 Vue 建構的開源互動晶體結構觀察室：透過 3D 模型、晶胞動畫與參數控制，探索七大晶系及原子排列。

> 開發中（M0 專案骨架）。實作方案見 [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)，概念規劃見 [`LatticeLab_Project_Plan.md`](LatticeLab_Project_Plan.md)。

## 開發

```bash
npm install
npm run dev     # 開發伺服器
npm test        # 幾何核心單元測試
npm run build   # 型別檢查 + 靜態建置
BASE_PATH=/crystal-scope/ npm run build   # GitHub Pages 子路徑
```

## 架構

| 目錄 | 責任 |
| --- | --- |
| `src/core/` | 幾何計算（純 TS）：晶胞驗證、基底矩陣、分率 ⇄ 直角座標、週期複製、晶向 |
| `src/data/` | 科學資料：七大晶系典型晶胞與晶胞設定說明 |
| `src/render/` | Three.js 渲染層（按需重繪、實例化球體） |
| `src/stores/` | Pinia：結構與歷史紀錄、介面設定 |
| `src/components/` | Vue 介面 |

## 限制

球體大小與顏色為示意比例；晶胞邊線不代表化學鍵；自由編輯後的結構標示為「自訂結構」，不宣稱仍屬原晶系。
