import { clone, endsWith, isEmpty, mergeRight, pickBy, slice } from 'ramda'

import { HOME_COMMUNITY } from '~/const/name'
import { ROUTE } from '~/const/route'
import { THREAD, THREAD_PATH } from '~/const/thread'
import { Global } from './helper'
import { path2Thread } from './thread'
import { nilOrEmpty } from './validator'

type TRouteArgs = {
  asPath: string
  url: string
  req?: {
    subdomains?: string[]
  }
}

type TRouteParts = {
  mainPath: string
  subPath: string
  thirdPath: string
}

type TParsedRoute = TRouteParts & {
  communityPath: string
  threadPath: string
}

type TSSRParsedRoute = TParsedRoute & {
  community: string
  thread: ReturnType<typeof path2Thread>
}

type TPagiType = 'string' | 'number'
type TRouteQueryValue = string | number
type TRouteQuery = Record<string, TRouteQueryValue>
type TQueryStringOptions = {
  noPagiInfo?: boolean
  pagi?: TPagiType
}

type TParsedDomain = {
  protocol?: string
  domain?: string
  path?: string | null
  subdomain?: string | null
  host?: string
  tld?: string
  parent_domain?: string
}

const getPathSegments = (path: string): string[] => path.split('?')[0].split('/').filter(Boolean)

// example: /xxx/getme?aa=bb&cc=dd
const parsePathList = (args: TRouteArgs): string[] => getPathSegments(args.url)

const INDEX = ''
const getMainPath = (args: TRouteArgs): string => {
  if (args.asPath === '/') return INDEX

  return getPathSegments(args.asPath)[0] || INDEX
}

const getSubPath = (args: TRouteArgs): string => {
  if (args.asPath === '/') return INDEX

  const asPathList = parsePathList(args)
  return asPathList[1] || INDEX
}

const getThirdPath = (args: TRouteArgs): string => {
  if (args.asPath === '/') return INDEX

  const asPathList = parsePathList(args)
  return asPathList[2] || INDEX
}

/**
 * parse subdomain of a url
 * like emacs.groupher.com
 * will return emacs
 * otherwise will return ""
 */
const parseSubDomain = (args: TRouteArgs): string => {
  let communityPath = ''
  const isServerSide = false
  if (isServerSide) {
    // on server side
    const subdomains = args.req?.subdomains || []
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

export const parseURL = (args: TRouteArgs): TParsedRoute => {
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
export const getRoutePathList = (path: string): string[] => getPathSegments(path)

export const getRouteMainPath = (asPath: string): string => {
  if (asPath === '/') return ROUTE.HOME

  return getPathSegments(asPath)[0] || ROUTE.HOME
}

export const ssrParseURL = (req: Pick<TRouteArgs, 'url'>): TSSRParsedRoute => {
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
  const mainPath = pathList[0] || ROUTE.HOME
  const subPath = pathList[1] || THREAD_PATH.POST
  const thirdPath = pathList[2] || INDEX

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

const mergePagiQuery = (
  query: TRouteQuery = {},
  opt: TQueryStringOptions = { pagi: 'string' },
): TRouteQuery => {
  const routeQuery = clone(query)

  let defaultQuery: TRouteQuery = { page: '1', size: '20' }

  if (opt.pagi === 'number') {
    defaultQuery = { page: 1, size: 20 }
  }

  if (typeof routeQuery.page === 'string' && opt.pagi === 'number') {
    routeQuery.page = Number.parseInt(routeQuery.page, 10)
  }

  return mergeRight(defaultQuery, routeQuery)
}

// convert url query string to json, with optional pagi info
export const queryStringToJSON = (
  path: string,
  opt: TQueryStringOptions = { noPagiInfo: false, pagi: 'string' },
): TRouteQuery => {
  const splited = path.split('?')
  if (splited.length === 1) return mergePagiQuery({}, opt)

  const result: TRouteQuery = {}
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
  const resolvedUrl = url || window.location.href
  const nameVal = name.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp(`[?&]${nameVal}(=([^&#]*)|&|#|$)`)
  const results = regex.exec(resolvedUrl)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export const serializeQuery = (obj: Record<string, unknown>): string => {
  const qstring = Object.keys(obj)
    .reduce((a: string[], k: string) => {
      a.push(`${k}=${encodeURIComponent(String(obj[k]))}`)
      return a
    }, [])
    .join('&')

  return isEmpty(qstring) ? '' : `?${qstring}`
}

export const parseDomain = (url: string): string | TParsedDomain => {
  try {
    const parsedUrl: TParsedDomain = {}

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
export const markRoute = (
  query: Record<string, unknown>,
  opt: TQueryStringOptions = { noPagiInfo: true },
): void => {
  let query$ = query
  if (nilOrEmpty(query)) query$ = {}

  const exsitQuery = queryStringToJSON(Global.location.search, {
    ...opt,
  })

  const newQueryObj = pickBy((v) => !nilOrEmpty(v), mergeRight(exsitQuery, query$))
  const newQueryString = serializeQuery(newQueryObj)

  Global.history.pushState({}, null, newQueryString)
}
