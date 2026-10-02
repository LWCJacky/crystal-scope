/** 由 vite.config.ts 的 define 注入：package.json 的版本與相依套件（名稱 → 版本範圍）。 */
declare const __APP_VERSION__: string
declare const __APP_DEPS__: Record<string, string>
