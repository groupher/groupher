import type { TComment, TLocale } from '~/spec'
import { trans } from '~/i18n'

// see: https://stackoverflow.com/a/66446126/4050784
const DateDiff = {
  inDays: (d1, d2): number => {
    const t2 = d2.getTime()
    const t1 = d1.getTime()

    // @ts-ignore
    return Number.parseInt((t2 - t1) / (24 * 3600 * 1000), 10)
  },

  inWeeks: (d1, d2): number => {
    const t2 = d2.getTime()
    const t1 = d1.getTime()

    // @ts-ignore
    return Number.parseInt((t2 - t1) / (24 * 3600 * 1000 * 7), 10)
  },

  inMonths: (d1, d2): number => {
    const d1Y = d1.getFullYear()
    const d2Y = d2.getFullYear()
    const d1M = d1.getMonth()
    const d2M = d2.getMonth()

    return d2M + 12 * d2Y - (d1M + 12 * d1Y)
  },

  inYears: (d1, d2): number => {
    return d2.getFullYear() - d1.getFullYear()
  },
}

export const passedDate = (
  curComment: TComment | undefined,
  nextComment: TComment | undefined,
  locale: TLocale,
): string | null => {
  if (!curComment || !nextComment) return null

  const { insertedAt: curInsertedAt } = curComment
  const { insertedAt: nextInsertedAt } = nextComment

  const diffInDays = DateDiff.inDays(new Date(curInsertedAt), new Date(nextInsertedAt))

  if (diffInDays >= 5 && diffInDays < 14) {
    return `${diffInDays} ${trans('comment.time.days_after', locale)}`
  }

  if (diffInDays >= 14 && diffInDays < 30) {
    const diffInWeeks = DateDiff.inWeeks(new Date(curInsertedAt), new Date(nextInsertedAt))
    return `${diffInWeeks} ${trans('comment.time.weeks_after', locale)}`
  }

  if (diffInDays >= 30 && diffInDays < 365) {
    const diffInMonths = DateDiff.inMonths(new Date(curInsertedAt), new Date(nextInsertedAt))
    return `${diffInMonths} ${trans('comment.time.months_after', locale)}`
  }

  const diffInYears = DateDiff.inYears(new Date(curInsertedAt), new Date(nextInsertedAt))
  return diffInYears !== 0
    ? `${diffInYears} ${trans('comment.time.years_after', locale)}`
    : null
}

export const holder = 1
