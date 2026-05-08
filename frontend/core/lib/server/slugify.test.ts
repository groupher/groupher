import { describe, expect, it } from 'vitest'

import { slugify } from './slugify'
import { validateSlug } from '../validator'

describe('slugify', () => {
  it('keeps latin text and converts han characters to pinyin', () => {
    expect(slugify('Next.js 中文教程')).toBe('next-js-zhong-wen-jiao-cheng')
    expect(slugify('React经验分享')).toBe('react-jing-yan-fen-xiang')
  })

  it('handles mixed latin, han, numbers, and separators', () => {
    expect(slugify('React 19 中文版 Part 2')).toBe('react-19-zhong-wen-ban-part-2')
    expect(slugify('API接口-v2')).toBe('api-jie-kou-v2')
    expect(slugify('  hello___world  ')).toBe('hello-world')
  })

  it('folds latin diacritics', () => {
    expect(slugify('Café Über uns')).toBe('cafe-uber-uns')
    expect(slugify('Crème brûlée à la carte')).toBe('creme-brulee-a-la-carte')
  })

  it('falls back when no URL-safe content remains', () => {
    expect(slugify('と')).toBe('untitled')
    expect(slugify('と', 'tag')).toBe('tag')
    expect(slugify('と', 'bad fallback')).toBe('untitled')
  })

  it('shares the same slug validator contract', () => {
    expect(validateSlug('react-19-zhong-wen').valid).toBe(true)
    expect(validateSlug('React').valid).toBe(false)
    expect(validateSlug('react--tag').valid).toBe(false)
    expect(validateSlug('-react').valid).toBe(false)
    expect(validateSlug('').valid).toBe(false)
  })
})
