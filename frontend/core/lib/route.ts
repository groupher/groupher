import {
  clone,
  compose,
  endsWith,
  head,
  includes,
  isEmpty,
  mergeRight,
  pickBy,
  prop,
  reject,
  slice,
  split,
} from 'ramda'

import { HOME_COMMUNITY } from '~/const/name'
import { ROUTE } from '~/const/route'
import { THREAD, THREAD_PATH } from '~/const/thread'
import { Global } from './helper'
import { path2Thread } from './thread'
import { nilOrEmpty } from './validator'

// example: /getme/xxx?aa=bb&cc=dd
const parseMainPath = compose(head, split('?'), head, reject(isEmpty), split('/'), prop('asPath'))

// example: /xxx/getme?aa=bb&cc=dd
// @ts-expect-error
const parsePathList = compose(
  reject(isEmpty),
  split('/'),
  head,
  reject(includes('=')),
  reject(isEmpty),
  split('?'),
  prop('url'),
)

const INDEX = ''
const getMainPath = (args: any): string => {
  if (args.asPath === '/') return INDEX

  // @ts-expect-error
  return parseMainPath(args)
}

const getSubPath = (args: any): string => {
  if (args.asPath === '/') return INDEX

  const asPathList = parsePathList(args)
  // @ts-expect-error
  const subPath = asPathList.length > 1 ? asPathList[1] : ''

  return subPath
}

const getThirdPath = (args: any): string => {
  if (args.asPath === '/') return INDEX

  const asPathList = parsePathList(args)
  // @ts-expect-error
  const subPath = asPathList.length > 2 ? asPathList[2] : ''

  return subPath
}

/**
 * parse subdomain of a url
 * like emacs.groupher.com
 * will return emacs
 * otherwise will return ""
 */
const parseSubDomain = (args: any): string => {
  let communityPath = ''
  const isServerSide = false
  if (isServerSide) {
    // on server side
    const { subdomains } = args.req
    if (!isEmpty(subdomains)) {
      communityPath = subdomains[subdomains.length - 1]
    }
  } else {
    // browser side
    const domain = /:\/\/([^/]+)/.exec(window.location.href)?.[1] ?? ''
    const domainList = domain.split('.')

    if (domainList.length >= 3) {
      communityPath = domainList[0]
    }
  }
  return communityPath
}

export const parseURL = (args: any): any => {
  let mainPath = ''
  let subPath = ''
  let thirdPath = ''
  let communityPath = parseSubDomain(args)
  let threadPath = ''

  if (communityPath === '') {
    mainPath = getMainPath(args)
    subPath = getSubPath(args)
    thirdPath = getThirdPath(args)
    communityPath = mainPath
    threadPath = subPath
  } else {
    mainPath = communityPath
    subPath = getMainPath(args)
    thirdPath = getSubPath(args)
    threadPath = subPath
  }

  return {
    communityPath,
    threadPath,
    mainPath,
    subPath,
    thirdPath,
  }
}

// --------------
// @ts-expect-error
export const getRoutePathList = compose(
  reject(isEmpty),
  split('/'),
  head,
  reject(includes('=')),
  reject(isEmpty),
  split('?'),
)

const doGetRouteMainPath = compose(head, split('?'), head, reject(isEmpty), split('/'))

export const getRouteMainPath = (asPath: string): string => {
  if (asPath === '/') return ROUTE.HOME

  // @ts-expect-error
  return doGetRouteMainPath(asPath)
}

export const ssrParseURL = (req: any): any => {
  const { url } = req
  if (url === '/') {
    const mainPath = 'home'
    const subPath = THREAD_PATH.POST

    return {
      community: mainPath,
      communityPath: mainPath,
      threadPath: subPath,
      mainPath,
      subPath,
      thirdPath: '',
      thread: THREAD.POST,
    }
  }

  const pathList = getRoutePathList(url)
  const mainPath = pathList[0]
  const subPath = pathList[1]
  const thirdPath = pathList[2] || ''

  const thread = endsWith('s', subPath) ? slice(0, -1, subPath) : subPath

  return {
    community: mainPath,
    communityPath: mainPath,
    threadPath: subPath,
    mainPath,
    subPath,
    thirdPath,
    thread: path2Thread(thread),
  }
}

export const akaTranslate = (communitySlug: string): string => {
  switch (communitySlug) {
    case 'k8s':
      return 'kubernetes'

    case 'js':
      return 'javascript'

    case 'webassembly':
      return 'wasm'

    case 'rn':
      return 'react-native'

    // 生产环境首页的诡异问题， fix later
    case 'index':
      return HOME_COMMUNITY.slug

    default:
      return communitySlug
  }
}

const mergePagiQuery = (query: any = {}, opt: any = { pagi: 'string' }): any => {
  const routeQuery = clone(query)

  let defaultQuery = { page: '1', size: '20' }

  if (opt.pagi === 'number') {
    // @ts-expect-error
    defaultQuery = { page: 1, size: 20 }
  }

  if (routeQuery.page && opt.pagi === 'number') {
    routeQuery.page = Number.parseInt(routeQuery.page, 10)
  }

  return mergeRight(defaultQuery, routeQuery)
}

// convert url query string to json, with optional pagi info
export const queryStringToJSON = (
  path: string,
  opt: any = { noPagiInfo: false, pagi: 'string' },
): any => {
  const splited = split('?', path)
  if (splited.length === 1) return mergePagiQuery({}, opt)

  const result: any = {}
  const paris = splited[1].split('&')

  for (const pair of paris) {
    const [key, value] = pair.split('=')
    result[key] = decodeURIComponent(value || '')
  }

  const json = JSON.parse(JSON.stringify(result))

  return opt.noPagiInfo ? json : mergePagiQuery(json, opt)
}

export const getParameterByName = (name: string): string | null => {
  const url = Global.location.href
  const name$ = name.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp(`[?&]${name$}(=([^&#]*)|&|#|$)`)
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export const getQueryFromUrl = (name: string, url: string): string | null => {
  if (!url) url = window.location.href
  const nameVal = name.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp(`[?&]${nameVal}(=([^&#]*)|&|#|$)`)
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export const serializeQuery = (obj: any): string => {
  const qstring = Object.keys(obj)
    .reduce((a: string[], k: string) => {
      a.push(`${k}=${encodeURIComponent(obj[k])}`)
      return a
    }, [])
    .join('&')

  return isEmpty(qstring) ? '' : `?${qstring}`
}

export const parseDomain = (url: string): any => {
  try {
    const parsedUrl: any = {}

    if (url === null || url.length === 0) return parsedUrl

    const protocolI = url.indexOf('://')
    parsedUrl.protocol = url.substr(0, protocolI)

    const remainingUrl = url.substr(protocolI + 3, url.length)
    let domainI = remainingUrl.indexOf('/')
    domainI = domainI === -1 ? remainingUrl.length - 1 : domainI
    parsedUrl.domain = remainingUrl.substr(0, domainI)
    parsedUrl.path =
      domainI === -1 || domainI + 1 === remainingUrl.length
        ? null
        : remainingUrl.substr(domainI + 1, remainingUrl.length)

    const domainParts = parsedUrl.domain.split('.')
    switch (domainParts.length) {
      case 2:
        parsedUrl.subdomain = null
        parsedUrl.host = domainParts[0]
        parsedUrl.tld = domainParts[1]
        break
      case 3:
        parsedUrl.subdomain = domainParts[0]
        parsedUrl.host = domainParts[1]
        parsedUrl.tld = domainParts[2]
        break
      case 4:
        parsedUrl.subdomain = domainParts[0]
        parsedUrl.host = domainParts[1]
        parsedUrl.tld = `${domainParts[2]}.${domainParts[3]}`
        break
    }

    parsedUrl.parent_domain = `${parsedUrl.host}.${parsedUrl.tld}`

    return parsedUrl.host
  } catch (e) {
    return `?? ${e}`
  }
}

// sync json query to the brower url without reload the page
// empty value obj will be omit
export const markRoute = (query: any, opt: any = { noPagiInfo: true }): void => {
  let query$ = query
  if (nilOrEmpty(query)) query$ = {}

  const exsitQuery = queryStringToJSON(Global.location.search, {
    ...opt,
  })

  const newQueryObj = pickBy((v: any) => !nilOrEmpty(v), mergeRight(exsitQuery, query$))
  const newQueryString = serializeQuery(newQueryObj)

  Global.history.pushState({}, null, newQueryString)
}
