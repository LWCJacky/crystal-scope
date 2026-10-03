import type { L10n } from '../i18n/types'

/**
 * 情境知識條目（規格 7.8）：介面依操作情境提示，術語依 IUCr 來源核對。
 * 這不是材料物性資料庫；個別材料數值另附來源。
 */
export interface KnowledgeEntry {
  id: string
  title: L10n
  summary: L10n
  details: L10n[]
  /** 公式或定義（純文字，不在地化）。 */
  formula?: string
  scope: L10n
  commonMistakes: L10n[]
  sources: { label: string; url: string }[]
  reviewStatus: 'reviewed' | 'draft'
}

const t = (zh: string, en: string, ja: string): L10n => ({ 'zh-TW': zh, en, ja })

const IUCR_DIRECTION = { label: 'IUCr — Direction indices', url: 'https://dictionary.iucr.org/Direction_indices' }
const IUCR_MILLER = { label: 'IUCr — Miller indices', url: 'https://dictionary.iucr.org/Miller_indices' }
const IUCR_RECIPROCAL = { label: 'IUCr — The reciprocal lattice', url: 'https://www.iucr.org/what-we-do/education/pamphlets/reciprocal-lattice' }
const IUCR_BRAVAIS = { label: 'IUCr — Bravais lattice', url: 'https://dictionary.iucr.org/Bravais_lattice' }

export const KNOWLEDGE: Record<string, KnowledgeEntry> = {
  direction: {
    id: 'direction',
    title: t('晶向 [uvw]', 'Direction [uvw]', '結晶方位 [uvw]'),
    summary: t('方向向量 = u a⃗ + v b⃗ + w c⃗；與起點無關。', 'The direction vector is u a + v b + w c; it does not depend on the origin.', '方向ベクトルは u a + v b + w c で、始点には依存しません。'),
    details: [
      t('[uvw] 以晶格向量的整數倍表示方向，可依方向約分（[220] 與 [110] 同向）。', '[uvw] expresses a direction as integer multiples of the lattice vectors and may be reduced ([220] has the same direction as [110]).', '[uvw] は格子ベクトルの整数倍で方向を表し、約分できます（[220] と [110] は同じ方向）。'),
      t('在非正交晶胞中，[uvw] 一般不垂直於 (uvw) 晶面。', 'In a non-orthogonal cell, [uvw] is in general not perpendicular to the (uvw) plane.', '非直交格子では、[uvw] は一般に (uvw) 面に垂直ではありません。'),
    ],
    formula: 'd = u·a + v·b + w·c',
    scope: t('兩種模式共用的觀察工具；修改晶向不移動原子。', 'A viewing tool shared by both modes; changing the direction never moves atoms.', '両モード共通の観察ツール。方位の変更は原子を動かしません。'),
    commonMistakes: [t('把 [uvw] 當成直角座標的方向。', 'Treating [uvw] as a Cartesian direction.', '[uvw] を直交座標の方向と見なす。'), t('[000] 不是方向。', '[000] is not a direction.', '[000] は方向ではありません。')],
    sources: [IUCR_DIRECTION],
    reviewStatus: 'reviewed',
  },
  miller: {
    id: 'miller',
    title: t('晶面 (hkl)', 'Lattice plane (hkl)', '格子面 (hkl)'),
    summary: t('平面族 h x + k y + l z = m（分率座標）；m 是序號，與沿法向的物理平移是兩件事。', 'The family h x + k y + l z = m in fractional coordinates; m is the order, distinct from a physical shift along the normal.', '分率座標で h x + k y + l z = m の面族。m は番号で、法線方向の物理的な平行移動とは別物です。'),
    details: [
      t('畫面上的晶面只是視覺切面，不刪除原子；要看佔有比例請用「裁切至晶胞」。', 'The drawn plane is a visual section only and removes no atoms; use “Clip to unit cell” to see occupancy fractions.', '表示される面は視覚的な断面であり、原子は除去されません。占有率を見るには「単位格子で切り取る」を使います。'),
      t('(hkl) 約分會改變所表示的間距與平面定位，因此介面不自動約分。', 'Reducing (hkl) changes the spacing and positioning it represents, so the interface never reduces it automatically.', '(hkl) を約分すると面間隔と位置の意味が変わるため、自動では約分しません。'),
      t('無交集時調整 m 或平移；截面由平面與展示區多面體求交得到。', 'If there is no intersection, change m or the shift; the section is the intersection of the plane with the displayed block.', '交差がない場合は m か平行移動を調整します。断面は面と表示ブロックの交差で求めます。'),
    ],
    formula: 'g = h a* + k b* + l c*,  g · r = m,  d = 1/|g|',
    scope: t('幾何上的平面序列；心型晶格的占點平面與繞射消光屬另一層問題。', 'Geometric plane sequence only; occupied planes of centred lattices and diffraction extinctions are a separate matter.', '幾何学的な面列のみ。中心化格子の占有面や回折の消滅則は別の話です。'),
    commonMistakes: [t('把 (h,k,l) 直接當成直角座標法向量。', 'Using (h,k,l) directly as a Cartesian normal vector.', '(h,k,l) をそのまま直交座標の法線ベクトルと見なす。'), t('從單一平面渲染推定繞射是否可見。', 'Inferring diffraction visibility from a single rendered plane.', '1 枚の面の表示から回折の可視性を推定する。')],
    sources: [IUCR_MILLER, IUCR_RECIPROCAL],
    reviewStatus: 'reviewed',
  },
  reciprocal: {
    id: 'reciprocal',
    title: t('倒晶格', 'Reciprocal lattice', '逆格子'),
    summary: t('a* = (b×c)/V、b* = (c×a)/V、c* = (a×b)/V；本專案統一不用 2π。', 'a* = (b×c)/V, b* = (c×a)/V, c* = (a×b)/V; this project uses the convention without 2π.', 'a* = (b×c)/V、b* = (c×a)/V、c* = (a×b)/V。本プロジェクトは 2π を付けない規約です。'),
    details: [t('g = h a* + k b* + l c* 垂直於 (hkl) 平面族，長度的倒數是相鄰整數 m 平面的間距。', 'g = h a* + k b* + l c* is normal to the (hkl) family; the reciprocal of its length is the spacing between successive integer-m planes.', 'g = h a* + k b* + l c* は (hkl) 面族に垂直で、その長さの逆数が隣接する整数 m 面の間隔です。')],
    formula: 'a* = (b × c) / V,  V = a · (b × c)',
    scope: t('幾何定義；物理教科書常見的 2π 慣例在此不採用。', 'Geometric definition; the 2π convention common in physics texts is not used here.', '幾何学的定義。物理の教科書に多い 2π の規約はここでは使いません。'),
    commonMistakes: [t('混用有 2π 與無 2π 的定義計算間距。', 'Mixing the 2π and non-2π conventions when computing spacings.', '2π ありとなしの定義を混ぜて面間隔を計算する。')],
    sources: [IUCR_RECIPROCAL],
    reviewStatus: 'reviewed',
  },
  coordination: {
    id: 'coordination',
    title: t('鄰近連線與配位', 'Neighbour links and coordination', '近接連結と配位'),
    summary: t('距離門檻只得到符合規則的鄰近關係，不能證明化學鍵；修改元素或座標後，來源材料的配位結論不再適用。', 'A distance cut-off only yields neighbours that satisfy the rule and does not prove a chemical bond; after changing elements or coordinates, the source material’s coordination conclusions no longer apply.', '距離のしきい値は規則に合う近接関係を与えるだけで、化学結合を証明しません。元素や座標を変えると、元の材料の配位に関する結論は適用できません。'),
    details: [
      t('資訊卡顯示的是「目前區塊內符合規則的連線數」，可見區塊邊緣缺少鄰居不等於材料配位數變少。', 'The card shows links matching the rule within the displayed block; missing neighbours at the block edge do not mean a lower coordination number.', 'カードに表示されるのは表示ブロック内で規則に合う連結数です。ブロック端で隣が欠けていても配位数が減るわけではありません。'),
      t('顯示半徑是視覺參數；原子半徑、離子半徑、共價半徑、范德華半徑不是同一套數據。', 'Display radii are visual parameters; atomic, ionic, covalent and van der Waals radii are different data sets.', '表示半径は視覚的なパラメータで、原子半径・イオン半径・共有結合半径・ファンデルワールス半径は別のデータです。'),
    ],
    scope: t('設計模式的自訂規則與教學模式的來源規則都適用。', 'Applies to custom rules in Design mode and to source rules in Learn mode.', '設計モードのカスタム規則と学習モードの元の規則の両方に当てはまります。'),
    commonMistakes: [t('把區塊內連線數當成材料配位數。', 'Reading the in-block link count as the coordination number.', 'ブロック内の連結数を配位数と見なす。')],
    sources: [IUCR_BRAVAIS],
    reviewStatus: 'reviewed',
  },
  representation: {
    id: 'representation',
    title: t('基元 × 心型 與 完整晶胞', 'Motif × centring vs. full cell', 'モチーフ × 中心化 と 単位格子全体'),
    summary: t('兩種表示不可混用：完整晶胞只做整數平移；把完整晶胞再套一次心型會重疊與過度計數。', 'The two representations must not be mixed: full-cell sites use integer translations only; applying a centring to a full cell again duplicates and over-counts atoms.', '2 つの表現は混在できません。単位格子全体は整数並進のみで、さらに中心化を適用すると重複と過剰計数になります。'),
    details: [t('FCC 銅：基元 1 顆 Cu + F 心型 = 每慣用晶胞 4 顆；完整晶胞模式則明列 4 顆，只做整數平移。', 'FCC copper: 1 Cu motif + F centring = 4 per conventional cell; the full-cell mode lists the 4 atoms and only translates by integers.', 'FCC 銅：モチーフ 1 個の Cu + F 中心化 = 慣用単位格子あたり 4 個。単位格子全体モードでは 4 個を列挙し、整数並進のみ行います。')],
    scope: t('設計模式；展開為完整晶胞後無法自動回到基元表示。', 'Design mode; after expanding to the full cell there is no automatic way back to the motif representation.', '設計モード。単位格子全体に展開した後は、モチーフ表現へ自動では戻れません。'),
    commonMistakes: [t('4 顆 Cu 再套 F 心型。', 'Applying F centring to the 4 listed Cu atoms.', '列挙した 4 個の Cu にさらに F 中心化を適用する。')],
    sources: [IUCR_BRAVAIS],
    reviewStatus: 'reviewed',
  },
  centering: {
    id: 'centering',
    title: t('心型與晶格類型', 'Centring and lattice type', '中心化と格子型'),
    summary: t('原子位於面心或體心，不等於晶格必為 F 或 I；要看該平移是否保持整個元素排列等價。', 'An atom at a face or body centre does not make the lattice F or I; what matters is whether the translation maps the whole arrangement onto itself.', '面心や体心に原子があっても格子が F や I とは限りません。その並進が配置全体を等価に写すかが問題です。'),
    details: [t('CsCl 用 cP 加兩元素基元；鑽石用 cF 加兩個 C 基元；HCP 是 hP 加兩個同種原子。', 'CsCl is cP with a two-element motif; diamond is cF with a two-carbon motif; HCP is hP with two identical atoms.', 'CsCl は cP と 2 元素のモチーフ、ダイヤモンドは cF と炭素 2 個のモチーフ、HCP は hP と同種原子 2 個です。')],
    scope: t('布拉菲晶格類型分類（aP、mP/mC、oP/oC/oI/oF、tP/tI、hP/hR、cP/cI/cF）。', 'Bravais lattice-type classification (aP, mP/mC, oP/oC/oI/oF, tP/tI, hP/hR, cP/cI/cF).', 'ブラベー格子型の分類（aP、mP/mC、oP/oC/oI/oF、tP/tI、hP/hR、cP/cI/cF）。'),
    commonMistakes: [t('CsCl 因體心有原子而判成 I 晶格。', 'Calling CsCl body-centred because an atom sits at the body centre.', '体心に原子があるので CsCl を I 格子と判断する。')],
    sources: [IUCR_BRAVAIS, { label: 'IUCr — Nomenclature for crystal families, Bravais-lattice types', url: 'https://www.iucr.org/who-we-are/commissions/commission-on-crystallographic-nomenclature/published-reports/bravais' }],
    reviewStatus: 'reviewed',
  },
}
