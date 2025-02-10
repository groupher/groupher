import { endsWith, includes } from 'ramda'
import { limit, length } from 'stringz'

import type { TArticleCat, TArticleState } from '~/spec'
import { THREAD } from '~/const/thread'
import { ARTICLE_CAT, ARTICLE_STATE } from '~/const/gtd'

import { isString } from './validator'

/**
 * cut extra length of a string
 * 截取固定长度字符串，并添加省略号（...）
 * @param {*string} str 需要进行处理的字符串，可含汉字
 * @param {*number} len 需要显示多少个汉字，两个英文字母相当于一个汉字
 */
export const cutRest = (str: string, len = 20): string => {
  if (!str || !isString(str)) return '...'
  return len >= length(str) ? str : `${limit(str, len, '')}...`
}

/**
 * prettyNum with human format
 * @see @link https://stackoverflow.com/questions/9461621/how-to-format-a-number-as-2-5k-if-a-thousand-or-more-otherwise-900-in-javascrip
 * e.g:
 * console.log(prettyNum(1200)) // => 1.2k
 *
 * @param {number} num
 * @param {number} [digits=1]
 * @returns {string}
 */
export const prettyNum = (num: number, digits = 1): string => {
  const si = [
    { value: 1, symbol: '' },
    { value: 1e3, symbol: 'k' },
    { value: 1e6, symbol: 'M' },
    { value: 1e9, symbol: 'G' },
    { value: 1e12, symbol: 'T' },
    { value: 1e15, symbol: 'P' },
    { value: 1e18, symbol: 'E' },
  ]
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/
  let i
  for (i = si.length - 1; i > 0; i -= 1) {
    if (num >= si[i].value) {
      break
    }
  }
  if (num < 1000) {
    return (num / si[i].value).toFixed(digits).replace(rx, '$1') + si[i].symbol
  }
  return `${(num / si[i].value).toFixed(digits).replace(rx, '$1') + si[i].symbol}+`
}

/**
 * number with commas foramt
 * @see @link https://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
 *
 * @param {*} x
 */
export const numberWithCommas = (x: number): string => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 *  titlize a string
 */
export const titleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (t) => {
    return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()
  })
}

export const titleCaseHM = (input: string): string => {
  // First, split the input string into words
  const words = input.split(/[-_\s]|(?=[A-Z])/).filter((word) => word.length > 0)

  // Then, capitalize the first letter of each word and lowercase the rest
  const titleCasedWords = words.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  )

  // Finally, join the words with spaces
  return titleCasedWords.join(' ')
}

// 将 kebab-case 或 snake_case 转换为 UPPER_SNAKE_CASE
export const upperSnakeCase = (str: string): string => {
  return str
    .split(/[-_]/)
    .map((word) => word.toUpperCase())
    .join('_')
}

/**
 *  camelize a string
 * e.g: GREEN_APPLE -> greenApple
 */
export const camelize = (str: string): string => {
  if (!str) return ''

  const a = str.toLowerCase().replace(/[-_\s.]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
  return a.substring(0, 1).toLowerCase() + a.substring(1)
}

// https://stackoverflow.com/a/2627482/4050784
export const daysBetween = (date1, date2) => {
  // The number of milliseconds in one day
  const ONE_DAY = 1000 * 60 * 60 * 24

  // Calculate the difference in milliseconds
  const differenceMs = Math.abs(date1 - date2)

  // Convert back to days and return
  return Math.round(differenceMs / ONE_DAY)
}

// birthday is a Date
const calculateAge = (birthday) => {
  const ageDifMs = Date.now() - birthday.getTime()
  const ageDate = new Date(ageDifMs) // miliseconds from epoch
  return Math.abs(ageDate.getUTCFullYear() - 1970)
}

export const siteBirthDay = (birthday: string): string => {
  const year = calculateAge(new Date(birthday))
  const days = daysBetween(new Date(birthday), Date.now()) - 365 * year

  return `${year}年${days}天`
}

type TCovert = 'titleCase' | 'upperCase' | null
const doCovert = (value: string, opt: TCovert): string => {
  switch (opt) {
    case 'titleCase': {
      return titleCase(value)
    }
    case 'upperCase': {
      return value.toUpperCase()
    }
    default: {
      return value
    }
  }
}

/**
 * mainly used for url -> thread convert
 *
 * e.g:
 * posts -> post
 */
export const singular = (value: string, opt = null): string => {
  switch (value) {
    default: {
      const singularValue = endsWith('s', value) ? value.slice(0, -1) : value
      return doCovert(singularValue, opt)
    }
  }
}

/**
 * mainly used for thread -> url convert
 *
 * e.g:
 * post -> posts
 */
export const plural = (value: string, opt = null): string => {
  if (
    includes(value, [THREAD.ACCOUNT, THREAD.DOC, THREAD.KANBAN, THREAD.ABOUT, THREAD.DASHBOARD])
  ) {
    return doCovert(value, opt)
  }

  return doCovert(`${value}s`, opt)
}

/**
 * @param num The number to round
 * @param precision The number of decimal places to preserve
 * see: https://stackoverflow.com/questions/5191088/how-to-round-up-a-number-in-javascript
 */
export const roundUpNumber = (num: number, precision = 0): number => {
  // eslint-disable-next-line no-restricted-properties
  const precisionPow = 10 ** precision
  return Math.ceil(num * precisionPow) / precisionPow
}

/**
 *  make url pretty
 *  https://bobbyhadz.com -> bobbyhadz.com
 *  http://bobbyhadz.com -> bobbyhadz.com
 */
export const prettyURL = (url: string): string => {
  return url.replace(/^https?:\/\//, '')
}

/**
 * alias GTD DONE key
 * 如果是问题，显示已解决，如果是其他，显示已完成
 */
export const aliasGTDDoneState = (cat: TArticleCat, state: TArticleState): string => {
  if (state !== ARTICLE_STATE.DONE) return state

  switch (cat) {
    case ARTICLE_CAT.BUG: {
      return ARTICLE_STATE.FIXED
    }
    case ARTICLE_CAT.QUESTION: {
      return ARTICLE_STATE.SOLVED
    }

    default: {
      return ARTICLE_STATE.DONE
    }
  }
}

const hex2RGB = (hex) => {
  const hexValues = hex
    .replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => `#${r}${r}${g}${g}${b}${b}`)
    .substring(1)
    .match(/.{2}/g)
    .map((x) => Number.parseInt(x, 16))
    .join(' ')

  return hexValues
}

/**
 * convert hex color to global goss blur if need
 */
export const blurRGB = (hex, blur = 100) => {
  if (!blur || blur === 100) return hex

  return `rgb(${hex2RGB(hex)} / ${blur}%)`
}

/**
 * fomrat opacity to tw style
 * e.g: '0.65' => 65 '1' => 100
 */
export const fmtOpacity = (str): number => {
  const num = Number.parseFloat(str)
  if (Number.isNaN(num)) {
    return 0
  }
  if (num >= 0 && num <= 1) {
    return Math.round(num * 100)
  }
  if (num >= 1 && num <= 100) {
    return Math.round(num)
  }
  return 0
}

/**
 * covert css style string into react component style tag way
 * e.g: filter: blur(3px) -> {filter: blur(3px)}
 */
export const fmt2CompStyle = (styleString: string): { [key: string]: string } => {
  if (styleString === '') {
    return {}
  }

  const styles = styleString.split(';').map((style) => style.trim())
  const result: { [key: string]: string } = {}

  for (const style of styles) {
    if (style) {
      const [property, value] = style.split(':').map((item) => item.trim())
      result[property] = value
    }
  }

  return result
}
