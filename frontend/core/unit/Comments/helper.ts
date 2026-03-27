import type { TComment } from '~/spec'

type TRTFUnit = Intl.RelativeTimeFormatUnit

const DAY = 24 * 60 * 60 * 1000

const getBrowserLocales = (): string[] => {
  if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
      return navigator.languages
    }
    if (navigator.language) return [navigator.language]
  }
  // SSR / 非浏览器环境：让 Intl 自己走默认 locale
  return []
}

/**
 * 将两个日期的差值，映射到你原先的展示规则：
 * - diffDays < 5 => 不显示
 * - 5~13 => days
 * - 14~29 => weeks
 * - 30~364 => months
 * - >=365 => years
 */
const diffToUnitValue = (from: Date, to: Date): { unit: TRTFUnit; value: number } | null => {
  const diffMs = to.getTime() - from.getTime()
  const diffDays = Math.floor(diffMs / DAY)

  if (diffDays < 5) return null

  if (diffDays < 14) {
    return { unit: 'day', value: diffDays }
  }

  if (diffDays < 30) {
    return { unit: 'week', value: Math.floor(diffDays / 7) }
  }

  if (diffDays < 365) {
    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
    return { unit: 'month', value: months }
  }

  const years = to.getFullYear() - from.getFullYear()
  return { unit: 'year', value: years }
}

/**
 * Timeline 用：显示“相隔多久”的 divider 文案
 * - 只使用浏览器 Intl（不依赖外部 i18n）
 * - locales 可选：不传则自动用 navigator.languages
 */
export const passedDate = (
  curComment: TComment | undefined,
  nextComment: TComment | undefined,
  locales?: string | string[],
): string | null => {
  if (!curComment || !nextComment) return null

  const from = new Date(curComment.insertedAt)
  const to = new Date(nextComment.insertedAt)

  const unitValue = diffToUnitValue(from, to)
  if (!unitValue) return null

  const rtf = new Intl.RelativeTimeFormat(locales ?? getBrowserLocales(), {
    numeric: 'always',
    style: 'long',
  })

  return rtf.format(unitValue.value, unitValue.unit)
}
