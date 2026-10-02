/** 專案、授權與第三方資源資訊（顯示於「關於」對話框）。 */
export const PROJECT = {
  name: 'CrystalScope',
  author: 'LWCJacky',
  year: 2026,
  license: 'GPL-3.0-or-later',
  licenseUrl: 'https://www.gnu.org/licenses/gpl-3.0.html',
  github: 'https://github.com/LWCJacky/crystal-scope',
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
} as const

export interface Dependency {
  name: string
  version: string
  license: string
  url: string
  /** runtime：隨網站一起發布；build：僅開發與建置時使用。 */
  role: 'runtime' | 'build'
}

const KNOWN: Record<string, { license: string; url: string; role: Dependency['role'] }> = {
  vue: { license: 'MIT', url: 'https://vuejs.org/', role: 'runtime' },
  pinia: { license: 'MIT', url: 'https://pinia.vuejs.org/', role: 'runtime' },
  three: { license: 'MIT', url: 'https://threejs.org/', role: 'runtime' },
  vite: { license: 'MIT', url: 'https://vite.dev/', role: 'build' },
  typescript: { license: 'Apache-2.0', url: 'https://www.typescriptlang.org/', role: 'build' },
  vitest: { license: 'MIT', url: 'https://vitest.dev/', role: 'build' },
  'vue-tsc': { license: 'MIT', url: 'https://github.com/vuejs/language-tools', role: 'build' },
  '@vitejs/plugin-vue': { license: 'MIT', url: 'https://github.com/vitejs/vite-plugin-vue', role: 'build' },
  '@vue/tsconfig': { license: 'MIT', url: 'https://github.com/vuejs/tsconfig', role: 'build' },
  '@types/three': { license: 'MIT', url: 'https://github.com/DefinitelyTyped/DefinitelyTyped', role: 'build' },
  '@types/node': { license: 'MIT', url: 'https://github.com/DefinitelyTyped/DefinitelyTyped', role: 'build' },
  '@fontsource-variable/nunito': { license: 'MIT (套件) / OFL-1.1 (字體)', url: 'https://fontsource.org/fonts/nunito', role: 'runtime' },
  '@fontsource/noto-sans-tc': { license: 'MIT (套件) / OFL-1.1 (字體)', url: 'https://fontsource.org/fonts/noto-sans-tc', role: 'runtime' },
  '@fontsource/noto-sans-jp': { license: 'MIT (套件) / OFL-1.1 (字體)', url: 'https://fontsource.org/fonts/noto-sans-jp', role: 'runtime' },
}

/** 由建置時注入的 package.json 清單產生；未知套件以 npm 頁面與「見套件授權」標示。 */
export const DEPENDENCIES: Dependency[] = Object.entries(typeof __APP_DEPS__ === 'object' ? __APP_DEPS__ : {})
  .map(([name, version]) => ({
    name,
    version: version.replace(/^[\^~]/, ''),
    license: KNOWN[name]?.license ?? '—',
    url: KNOWN[name]?.url ?? `https://www.npmjs.com/package/${name}`,
    role: KNOWN[name]?.role ?? 'build',
  }))
  .sort((p, q) => (p.role === q.role ? p.name.localeCompare(q.name) : p.role === 'runtime' ? -1 : 1))

/** 字體經 Fontsource 套件隨網站打包，不連外部服務。 */
export const FONTS = [
  { name: 'Nunito (variable)', license: 'SIL OFL 1.1', url: 'https://fontsource.org/fonts/nunito' },
  { name: 'Noto Sans TC', license: 'SIL OFL 1.1', url: 'https://fontsource.org/fonts/noto-sans-tc' },
  { name: 'Noto Sans JP', license: 'SIL OFL 1.1', url: 'https://fontsource.org/fonts/noto-sans-jp' },
] as const
