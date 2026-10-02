/**
 * 全站共用的使用者設定集：每一項定義預設值與驗證規則。
 * 從 cookie 讀回的資料一律經過 sanitize，型別不符或超出範圍的值改用預設值。
 */

interface SettingDef<T> {
  default: T
  parse: (raw: unknown) => T | undefined
  label: string
}

const bool = (def: boolean, label: string): SettingDef<boolean> => ({
  default: def,
  label,
  parse: (raw) => (typeof raw === 'boolean' ? raw : undefined),
})

const num = (def: number, min: number, max: number, label: string): SettingDef<number> => ({
  default: def,
  label,
  parse: (raw) => (typeof raw === 'number' && Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : undefined),
})

const oneOf = <T extends string | number>(def: T, values: readonly T[], label: string): SettingDef<T> => ({
  default: def,
  label,
  parse: (raw) => (values.includes(raw as T) ? (raw as T) : undefined),
})

export const SETTINGS_SCHEMA = {
  // 演示與動畫
  autoplay: bool(true, '點選範例時自動播放演示'),
  autoRotate: bool(true, '演示完成後自動旋轉'),
  autoRotateSeconds: num(40, 10, 120, '自轉一圈秒數'),
  demoSpeed: oneOf(1, [0.5, 1, 2] as const, '演示速度'),
  assemblyMode: oneOf('wedge6', ['wedge6', 'cell3'] as const, '六方柱拼裝方式'),
  // 介面
  appMode: oneOf('explore', ['explore', 'presentation'] as const, '介面模式'),
  tourSeen: bool(false, '已看過導覽'),
  // 顯示
  showAxes: bool(true, '顯示晶格向量'),
  showCellEdges: bool(true, '顯示晶胞邊線'),
  showBoundaryImages: bool(true, '顯示邊界複本'),
  showBonds: bool(true, '顯示鍵'),
  showAngles: bool(true, '顯示晶軸夾角 α、β、γ'),
  sphereScale: num(1, 0.3, 1.6, '球體大小倍率'),
} as const

type Schema = typeof SETTINGS_SCHEMA
export type Settings = { -readonly [K in keyof Schema]: Schema[K]['default'] extends infer D ? (D extends boolean ? boolean : D extends number ? number : D) : never }
export type SettingKey = keyof Settings

export function defaultSettings(): Settings {
  return Object.fromEntries(Object.entries(SETTINGS_SCHEMA).map(([k, d]) => [k, d.default])) as Settings
}

/** 以預設值為底，套用合法的已存值；未知欄位忽略。 */
export function sanitizeSettings(raw: unknown): Settings {
  const result = defaultSettings() as Record<string, unknown>
  if (raw && typeof raw === 'object') {
    for (const [key, def] of Object.entries(SETTINGS_SCHEMA)) {
      const parsed = (def as SettingDef<unknown>).parse((raw as Record<string, unknown>)[key])
      if (parsed !== undefined) result[key] = parsed
    }
  }
  return result as Settings
}

/** 只保存與預設值不同的欄位，讓 cookie 保持精簡。 */
export function diffFromDefaults(settings: Settings): Partial<Settings> {
  const defaults = defaultSettings()
  return Object.fromEntries(
    (Object.keys(settings) as SettingKey[]).filter((k) => settings[k] !== defaults[k]).map((k) => [k, settings[k]]),
  ) as Partial<Settings>
}
