import { find, includes, isEmpty, keys, propEq, remove, sort, startsWith, tap, uniq } from 'ramda'
import { ASSETS_ENDPOINT, TAG_COLOR_ORDER } from '~/config'
import { COLOR_NAME } from '~/const/colors'
import { ARTICLE_STATE } from '~/const/gtd'
import type {
  TArticleState,
  TColorName,
  TCommunityThread,
  TDsdThreadConf,
  TNameAlias,
  TWindow,
} from '~/spec'

type TSORTABLE_ITEMS = {
  color?: string
  index?: number
  groupIndex?: number
  id?: string
  title?: string
  slug: string
  logo?: string
  group?: string
}[]

export const Global: TWindow = typeof window !== 'undefined' ? window : null

/**
 * sort the array by it's color
 */
export const sortByColor = (source: TSORTABLE_ITEMS): TSORTABLE_ITEMS =>
  sort((t1, t2) => TAG_COLOR_ORDER[t1.color] - TAG_COLOR_ORDER[t2.color], source)

/**
 * sort the array by it's index
 */
export const sortByIndex = (source: TSORTABLE_ITEMS, key = 'index'): TSORTABLE_ITEMS => {
  if (isEmpty(source)) return []

  return sort((a, b) => a[key] - b[key], source)
}

/* eslint-disable */
const log =
  (...args) =>
  (data) => {
    console.log.apply(null, args.concat([data]))
    return data
  }
/* eslint-enable */

// reference: https://blog.carbonfive.com/2017/12/20/easy-pipeline-debugging-with-curried-console-log/
export const Rlog = (arg = 'Rlog: ') => tap(log(arg))

/**
 * count both chinese-word and english-words
 * @see @link https://stackoverflow.com/questions/20396456/how-to-do-word-counts-for-a-mixture-of-english-and-chinese-in-javascript
 *
 * @param {string} str
 * @returns {number}
 */
export const countWords = (str: string): number => {
  const matches = str.match(/[\u00ff-\uffff]|\S+/g)
  return matches ? matches.length : 0
}

// errRescue({type: ERR.GRAPHQL, operation: operationName, details: graphQLErrors})

export const debounce = (fn, ms = 0) => {
  let timeoutId: ReturnType<typeof setTimeout>
  // eslint-disable-next-line func-names
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn.apply(this, args), ms)
  }
}

/**
 * extract mention format from markdown str into list
 */
export const extractMentions = (str: string): string[] => {
  const mentionsRegex = /@([a-zA-Z0-9_.-]+)/gim

  let matches = str.match(mentionsRegex)
  if (matches?.length) {
    // @ts-expect-error
    matches = matches.map((match) => {
      return match.slice(1)
    })
    return uniq(matches)
  }
  return []
}

/**
 * extract markdown attachments from str
 * @see @link https://blogs.sap.com/2017/07/15/use-regular-expression-to-parse-the-image-reference-in-the-markdown-sourcre-code/
 */
export const extractAttachments = (str: string): string[] => {
  let m: RegExpExecArray | null
  const regex = /!\[(.*?)\]\((.*?)\)/g

  const urls = []
  // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
  while ((m = regex.exec(str)) !== null) {
    if (m.index === regex.lastIndex) {
      regex.lastIndex += 1
    }
    urls.push(m[2])
  }
  /* eslint-enable */
  return urls
}

// checkout if the site is running on cypress container
export const isCypressRunning = (): boolean => {
  // @ts-expect-error
  if (typeof window !== 'undefined') return !!window.Cypress

  return false
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 *
 * see: https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range
 */
export const getRandomInt = (min: number, max: number): number => {
  const minNum = Math.ceil(min)
  const maxNum = Math.floor(max)
  return Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum
}

export const num2Percent = (decimal: number): string => {
  if (!decimal) return '0%'

  const percentage = (decimal * 100).toFixed(1)
  return `${percentage}%`
}

/**
 * get radom backgrounds from COLOR_NAMEs
 */
export const randomBgNames = (
  count,
  excepts = [COLOR_NAME.CYAN, COLOR_NAME.GREEN],
): TColorName[] => {
  let colorKeys = isEmpty(excepts)
    ? keys(COLOR_NAME)
    : keys(COLOR_NAME).filter((k) => !includes(k, excepts))

  let randomIdx: number
  const ret = []

  for (let idx = 0; idx < count; idx += 1) {
    if (isEmpty(colorKeys)) break

    randomIdx = getRandomInt(0, colorKeys.length - 1)
    ret.push(colorKeys[randomIdx])
    colorKeys = remove(randomIdx, 1, colorKeys)
  }

  return ret
}

/**
 * find key=value in array or object
 *
 * see original version:
 * https://stackoverflow.com/a/15524326
 * @param {object or Array} data
 * @param {String} key
 * @param {String} value
 * @returns
 */
export const findDeepMatch = (data, key, value) => {
  let result = null
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i += 1) {
      // console.log('## > the data[i]', data[i])
      result = findDeepMatch(data[i], key, value)
      // end the recursive function
      if (result) return result
    }
  } else {
    const theKeys = keys(data)
    for (let index = 0; index < theKeys.length; index += 1) {
      const prop = theKeys[index]
      if (prop === key && data[prop] === value) {
        return data
      }
      if (data[prop] instanceof Object || Array.isArray(data[prop])) {
        result = findDeepMatch(data[prop], key, value)
      }
    }
  }

  return result
}

/**
 * groupByKey
 * see @link: https://stackoverflow.com/a/47385953/4050784
 * NOTE: type this is diffcult for me, need help
 * 有人能做得来这个类型体操吗。。。
 *
 * @param {Array} - array
 * @param {String} - key
 * @returns {Object}
 */
export const groupByKey = (array, key) => {
  return array.reduce((hash, obj) => {
    if (obj[key] === undefined) return hash
    return Object.assign(hash, {
      [obj[key]]: (hash[obj[key]] || []).concat(obj),
    })
  }, {})
}

type TShareParam = {
  url?: string
  title?: string
  text?: string
  subject?: string
  body?: string
  u?: string
  href?: string
  name?: string
}
export const openShareWindow = (platformUrl: string, param: TShareParam): void => {
  const safeParam = []

  /* eslint-disable */
  for (const i in param) {
    safeParam.push(`${i}=${encodeURIComponent(param[i] || '')}`)
  }
  /* eslint-enable */
  const targetUrl = `${platformUrl}?${safeParam.join('&')}`

  Global.open(targetUrl, '_blank', 'height=500, width=600')
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

/**
 * check if article state is one of the rejected states
 */
export const isRejectedState = (state: TArticleState): boolean => {
  return includes(state, [
    ARTICLE_STATE.REJECT_DUP,
    ARTICLE_STATE.REJECT_NO_PLAN,
    ARTICLE_STATE.REJECT_REPRO,
    ARTICLE_STATE.REJECT_STALE,
  ])
}

/**
 * remove empty value from given object
 */
export const removeEmptyValuesFromObject = (object) => {
  const newObject = {}

  for (const key in object) {
    if (Object.hasOwn(object, key)) {
      const value = object[key]
      if (value !== null && value !== undefined) {
        newObject[key] = value
      }
    }
  }

  return newObject
}

/**
 * filter public threads & map alias name for community's threads
 */
export const publicThreads = (
  threads: TCommunityThread[],
  dashboardSettings: TDsdThreadConf,
): TCommunityThread[] => {
  const { enable, nameAlias } = dashboardSettings

  const enabledThreads = sortByIndex(threads.filter((thread) => enable[thread.slug]))

  const mappedThreads = enabledThreads.map((pThread) => {
    const aliasItem = find(propEq(pThread.slug, 'slug'))(nameAlias) as TNameAlias

    return {
      ...pThread,
      title: aliasItem?.name || pThread.title,
    }
  })

  return mappedThreads as TCommunityThread[]
}

/**
 * for combine OSS endpoing with path
 */
export const assetSrc = (path: string): string => {
  if (!path) return ''

  if (startsWith('http://', path) || startsWith('https://', path)) {
    return path
  }

  return `${ASSETS_ENDPOINT}/${path}`
}

/**
 * for store to server
 */
export const assetPath = (url: string): string => {
  const splitUrl = url.split(`${ASSETS_ENDPOINT}/`)

  return splitUrl.join('')
}

/**
 * Creates a type-safe predicate that checks whether a string value
 * belongs to a predefined set of allowed values.
 *
 * This is a low-level, generic utility. It does not assume where the
 * values come from (enum, const array, runtime config, etc.).
 *
 * Typical use cases:
 * - Validating route segments
 * - Validating query params
 * - Narrowing string unions at runtime
 *
 * @example
 * const isTab = isOneOf(['general', 'advanced'] as const)
 *
 * if (isTab(value)) {
 *   // value is now typed as 'general' | 'advanced'
 * }
 */
export const isOneOf = <const T extends readonly string[]>(candidates: T) => {
  const set = new Set(candidates)

  return (value: string): value is T[number] => {
    return set.has(value)
  }
}
