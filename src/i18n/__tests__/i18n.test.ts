import { describe, expect, it } from 'vitest'
import { interpolate, MESSAGES, termText, translate } from '../index'
import { TERMS } from '../terms'
import { detectLocale, LOCALE_IDS } from '../types'
import { CRYSTAL_SYSTEMS } from '../../data/crystalSystems'
import { ELEMENTS } from '../../data/elements'
import { MATERIALS } from '../../data/materials'
import { TOUR_STEPS } from '../../data/tourSteps'

describe('message tables', () => {
  it('have identical key sets in every locale', () => {
    const base = Object.keys(MESSAGES['zh-TW']).sort()
    for (const id of LOCALE_IDS) expect(Object.keys(MESSAGES[id]).sort()).toEqual(base)
  })

  it('keep the same placeholders in every locale', () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
    for (const key of Object.keys(MESSAGES.en) as (keyof typeof MESSAGES.en)[]) {
      for (const id of LOCALE_IDS) expect(placeholders(MESSAGES[id][key])).toEqual(placeholders(MESSAGES.en[key]))
    }
  })

  it('interpolates parameters', () => {
    expect(interpolate('{n} 秒', { n: 40 })).toBe('40 秒')
    expect(translate('en', 'panel.module', { n: '03' })).toBe('Module 03')
  })
})

describe('technical terms', () => {
  it('show the English original beside the translation, and English alone in English', () => {
    expect(termText('en', 'latticePoint')).toBe('Lattice point')
    expect(termText('zh-TW', 'latticePoint')).toBe('晶格點 (Lattice point)')
    expect(termText('ja', 'latticePoint')).toBe('格子点 (Lattice point)')
  })

  it('are defined for all locales', () => {
    for (const t of Object.values(TERMS)) for (const id of LOCALE_IDS) expect(t[id]).toBeTruthy()
  })
})

describe('localised data', () => {
  it('provides every locale for systems, materials, elements and tour steps', () => {
    for (const s of [...CRYSTAL_SYSTEMS, ...MATERIALS]) {
      for (const id of LOCALE_IDS) {
        expect(s.name[id]).toBeTruthy()
        expect(s.cellSetting[id]).toBeTruthy()
        expect(s.relations[id]).toBeTruthy()
        expect(s.description[id]).toBeTruthy()
        if (s.reference) expect(s.reference[id]).toBeTruthy()
        for (const p of s.parameters ?? []) expect(p.note[id]).toBeTruthy()
      }
    }
    for (const e of Object.values(ELEMENTS)) for (const id of LOCALE_IDS) expect(e.name[id]).toBeTruthy()
    for (const step of TOUR_STEPS) for (const id of LOCALE_IDS) {
      expect(step.title[id]).toBeTruthy()
      // 語言選擇步驟以按鈕取代說明文字
      if (step.kind !== 'language') expect(step.body[id].length).toBeGreaterThan(0)
    }
  })
})

describe('detectLocale', () => {
  it('maps browser languages to supported locales, defaulting to English', () => {
    expect(detectLocale(['zh-TW', 'en'])).toBe('zh-TW')
    expect(detectLocale(['ja-JP'])).toBe('ja')
    expect(detectLocale(['de-DE', 'en-GB'])).toBe('en')
    expect(detectLocale(['fr'])).toBe('en')
  })
})
