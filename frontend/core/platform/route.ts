import {
  DSB_APPEARANCE_ROUTE,
  DSB_ALIAS_ROUTE,
  DSB_BROADCAST_ROUTE,
  DSB_CHANGELOG_ROUTE,
  DSB_DOMAIN_ROUTE,
  DSB_DOC_LAYOUT_ROUTE,
  DSB_DOC_ROUTE,
  DSB_INFO_ROUTE,
  DSB_KANBAN_ROUTE,
  DSB_POST_ROUTE,
  DSB_ROUTE,
  DSB_SEO_ROUTE,
  DSB_THIRD_PART_ROUTE,
} from '~/const/route'
import URL_PARAM from '~/const/url_param'

import type { TCommunityRouteTarget, TRouteSearch, TRouteTarget, TDsbRouteTarget } from './types'

export const DSB_SEARCH_KEYS = ['mode', 'other', ...Object.values(URL_PARAM)] as const

const DSB_ROUTE_SEARCH_KEYS: { [section: string]: readonly string[] } = {
  [`${DSB_ROUTE.POST}/${DSB_POST_ROUTE.CONTENT}`]: ['tab'],
  [`${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.EDITOR}`]: ['docId'],
  [`${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.IMPORT}`]: ['preview', 'job'],
}

type TSearchSchema = readonly string[]

type TRouteMeta = {
  community: string
  segments: string[]
}

const trimPath = (value: string): string => value.replace(/^\/+|\/+$/g, '')

const toSearchString = (search: TRouteSearch): string => {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(search)) {
    if (value === null || value === undefined) continue
    query.set(key, String(value))
  }

  const value = query.toString()
  return value ? `?${value}` : ''
}

const dedupe = (values: readonly string[]): string[] => Array.from(new Set(values))

const resolveSearchSchema = (path: string): TSearchSchema => {
  const normalizedPath = trimPath(path)
  const candidates = Object.entries(DSB_ROUTE_SEARCH_KEYS)
    .filter(([prefix]) => {
      const normalizedPrefix = trimPath(prefix)
      return (
        normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`)
      )
    })
    .sort(([a], [b]) => b.length - a.length)

  if (candidates.length === 0) return []

  return candidates[0][1]
}

const toSearchSchema = (path: string): TSearchSchema =>
  dedupe([...DSB_SEARCH_KEYS, ...resolveSearchSchema(path)])

const parseSearchKeys = (
  searchParams: URLSearchParams,
  allowlist: readonly string[],
): TRouteSearch => {
  const next: TRouteSearch = {}
  const keys = dedupe(allowlist)

  if (keys.length === 0) {
    for (const [key, value] of searchParams.entries()) {
      next[key] = value
    }
    return next
  }

  for (const key of keys) {
    const value = searchParams.get(key)
    if (value !== null) {
      next[key] = value
    }
  }

  return next
}

/** Runs the to dsb target from path operation at the frontend shared boundary. */
export const toDsbTargetFromPath = (rawPath: string): TDsbRouteTarget | null => {
  if (!rawPath) return null

  const parsed = new URL(rawPath, 'https://groupher.localhost')
  const targetMeta = parseDsbPathname(parsed.pathname)

  if (!targetMeta) return null
  const targetPath = targetMeta.segments.join('/')
  const schema = toSearchSchema(targetPath)

  return {
    app: 'dsb',
    community: targetMeta.community,
    path: targetPath,
    search: parseSearchKeys(parsed.searchParams, schema),
    searchSchema: schema,
    preserveSearchKeys: [...DSB_SEARCH_KEYS],
  }
}

/** Parses dsb pathname into the canonical frontend shared representation. */
export const parseDsbPathname = (pathname: string): TRouteMeta | null => {
  const normalized = trimPath(pathname)
  const segments = normalized.split('/').filter(Boolean)
  const community = segments[0]
  if (!community) return null

  const routeSegments = segments.slice(1)
  const normalizedRouteSegments =
    routeSegments[0] === 'overview' ? routeSegments.slice(1) : routeSegments

  return {
    community,
    segments: normalizedRouteSegments,
  }
}

const mergeSearch = (
  target: TRouteTarget,
  options: { preserveSearch?: boolean; currentSearch?: URLSearchParams },
): TRouteSearch => {
  const merged: TRouteSearch = {}
  const schema =
    target.app === 'dsb'
      ? dedupe([...DSB_SEARCH_KEYS, ...(target.searchSchema ?? resolveSearchSchema(target.path))])
      : dedupe(target.searchSchema ?? [])
  const explicitPreserveKeys = dedupe(target.preserveSearchKeys ?? [])
  const allowedKeys = new Set([...schema, ...explicitPreserveKeys])

  if (options.preserveSearch) {
    const keys = explicitPreserveKeys.length > 0 ? [...schema, ...explicitPreserveKeys] : schema

    for (const key of dedupe(keys)) {
      const value = options.currentSearch?.get(key)
      if (value === null) continue
      merged[key] = value
    }
  }

  if (target.search) {
    for (const [key, value] of Object.entries(target.search)) {
      if (!allowedKeys.has(key)) continue
      if (value === null || value === undefined) {
        delete merged[key]
      } else {
        merged[key] = value
      }
    }
  }

  return merged
}

export type TRouteMetaTarget = {
  community: string
  section: string
  search?: TRouteSearch
  searchSchema?: TSearchSchema
  preserveSearchKeys?: readonly string[]
}

const createSection = (path: string) => {
  return (input: {
    community: string
    search?: TRouteSearch
    searchSchema?: TSearchSchema
    preserveSearchKeys?: readonly string[]
  }): TDsbRouteTarget => ({
    app: 'dsb',
    community: input.community,
    path: trimPath(path),
    search: input.search,
    searchSchema: input.searchSchema ?? toSearchSchema(path),
    preserveSearchKeys: input.preserveSearchKeys ?? DSB_SEARCH_KEYS,
  })
}

const createSectionWithSearch = () => {
  return (input: TRouteMetaTarget): TDsbRouteTarget => ({
    app: 'dsb',
    community: input.community,
    path: trimPath(input.section),
    search: input.search,
    searchSchema: input.searchSchema ?? toSearchSchema(input.section),
    preserveSearchKeys: input.preserveSearchKeys ?? DSB_SEARCH_KEYS,
  })
}

export const DSB_ROUTES = {
  overview: createSection(''),
  info: createSection(DSB_ROUTE.INFO),
  infoLogos: createSection(`${DSB_ROUTE.INFO}/${DSB_INFO_ROUTE.LOGOS}`),
  infoSocial: createSection(`${DSB_ROUTE.INFO}/${DSB_INFO_ROUTE.SOCIAL}`),
  seo: createSection(DSB_ROUTE.SEO),
  seoTwitter: createSection(`${DSB_ROUTE.SEO}/${DSB_SEO_ROUTE.TWITTER}`),
  seoSearchEngine: createSection(`${DSB_ROUTE.SEO}/${DSB_SEO_ROUTE.SEARCH_ENGINE}`),
  appearance: createSection(DSB_ROUTE.APPEARANCE),
  appearanceTheme: createSection(`${DSB_ROUTE.APPEARANCE}/${DSB_APPEARANCE_ROUTE.THEME}`),
  appearanceWallpaper: createSection(`${DSB_ROUTE.APPEARANCE}/${DSB_APPEARANCE_ROUTE.WALLPAPER}`),
  appearanceDoc: createSection(`${DSB_ROUTE.APPEARANCE}/${DSB_APPEARANCE_ROUTE.DOC}`),
  appearancePost: createSection(`${DSB_ROUTE.APPEARANCE}/${DSB_APPEARANCE_ROUTE.POST}`),
  threads: createSection(DSB_ROUTE.THREADS),
  alias: createSection(DSB_ROUTE.ALIAS),
  domain: createSection(DSB_ROUTE.DOMAIN),
  analysis: createSection(DSB_ROUTE.ANALYSIS),
  trend: createSection(DSB_ROUTE.TREND),
  assets: createSection(DSB_ROUTE.ASSETS),
  tags: createSection(DSB_ROUTE.TAGS),
  post: createSection(DSB_ROUTE.POST),
  postLayout: createSection(`${DSB_ROUTE.POST}/${DSB_POST_ROUTE.LAYOUT}`),
  postAnalysis: createSection(`${DSB_ROUTE.POST}/${DSB_POST_ROUTE.ANALYSIS}`),
  postContent: createSection(`${DSB_ROUTE.POST}/${DSB_POST_ROUTE.CONTENT}`),
  postBehavior: createSection(`${DSB_ROUTE.POST}/${DSB_POST_ROUTE.BEHAVIOR}`),
  postTrash: createSection(`${DSB_ROUTE.POST}/${DSB_POST_ROUTE.TRASH}`),
  kanban: createSection(DSB_ROUTE.KANBAN),
  kanbanLayout: createSection(`${DSB_ROUTE.KANBAN}/${DSB_KANBAN_ROUTE.LAYOUT}`),
  kanbanAnalysis: createSection(`${DSB_ROUTE.KANBAN}/${DSB_KANBAN_ROUTE.ANALYSIS}`),
  kanbanContent: createSection(`${DSB_ROUTE.KANBAN}/${DSB_KANBAN_ROUTE.CONTENT}`),
  kanbanBehavior: createSection(`${DSB_ROUTE.KANBAN}/${DSB_KANBAN_ROUTE.BEHAVIOR}`),
  changelog: createSection(DSB_ROUTE.CHANGELOG),
  changelogLayout: createSection(`${DSB_ROUTE.CHANGELOG}/${DSB_CHANGELOG_ROUTE.LAYOUT}`),
  changelogAnalysis: createSection(`${DSB_ROUTE.CHANGELOG}/${DSB_CHANGELOG_ROUTE.ANALYSIS}`),
  changelogContent: createSection(`${DSB_ROUTE.CHANGELOG}/${DSB_CHANGELOG_ROUTE.CONTENT}`),
  changelogBehavior: createSection(`${DSB_ROUTE.CHANGELOG}/${DSB_CHANGELOG_ROUTE.BEHAVIOR}`),
  communities: createSection(DSB_ROUTE.COMMUNITIES),
  widgets: createSection(DSB_ROUTE.WIDGETS),
  doc: createSection(DSB_ROUTE.DOC),
  docAnalysis: createSection(`${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.ANALYSIS}`),
  docLayout: createSection(`${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.LAYOUT}`),
  docCover: createSection(`${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.COVER}`),
  docEditor: createSection(`${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.EDITOR}`),
  docFaq: createSection(`${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.FAQ}`),
  docGitSync: createSection(`${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.GIT_SYNC}`),
  docDomain: createSection(`${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.DOMAIN}`),
  docImport: createSection(`${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.IMPORT}`),
  docBackup: createSection(`${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.BACKUP}`),
  docLayoutCover: createSection(`${DSB_ROUTE.DOC}/${DSB_DOC_LAYOUT_ROUTE.COVER}`),
  docLayoutFaq: createSection(`${DSB_ROUTE.DOC}/${DSB_DOC_LAYOUT_ROUTE.FAQ}`),
  thirdPart: createSection(DSB_ROUTE['THIRD-PART']),
  thirdPartAnalytics: createSection(`${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.ANALYTICS}`),
  thirdPartWebhooks: createSection(`${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.WEBHOOKS}`),
  thirdPartBots: createSection(`${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.BOTS}`),
  thirdPartEmail: createSection(`${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.EMAIL}`),
  thirdPartContentSync: createSection(
    `${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.CONTENT_SYNC}`,
  ),
  admins: createSection(DSB_ROUTE.ADMINS),
  broadcast: createSection(DSB_ROUTE.BROADCAST),
  broadcastGlobal: createSection(`${DSB_ROUTE.BROADCAST}/${DSB_BROADCAST_ROUTE.GLOBAL}`),
  broadcastArticle: createSection(`${DSB_ROUTE.BROADCAST}/${DSB_BROADCAST_ROUTE.ARTICLE}`),
  aliasThread: createSection(`${DSB_ROUTE.ALIAS}/${DSB_ALIAS_ROUTE.THREAD}`),
  aliasKanban: createSection(`${DSB_ROUTE.ALIAS}/${DSB_ALIAS_ROUTE.KANBAN}`),
  aliasOthers: createSection(`${DSB_ROUTE.ALIAS}/${DSB_ALIAS_ROUTE.OTHERS}`),
  domainPlatform: createSection(`${DSB_ROUTE.DOMAIN}/${DSB_DOMAIN_ROUTE.PLATFORM}`),
  domainCustom: createSection(`${DSB_ROUTE.DOMAIN}/${DSB_DOMAIN_ROUTE.CUSTOM}`),
  section: createSectionWithSearch(),
} as const

export const dsbRoutes = DSB_ROUTES

/** Resolves dsb route without leaking frontend shared routing details to callers. */
export const resolveDsbRoute = (
  target: TDsbRouteTarget,
  options: {
    currentSearch?: URLSearchParams | string
    preserveSearch?: boolean
  },
): string => {
  const path = trimPath(target.path)
  const resolvedPath = path.length === 0 ? 'overview' : path
  const normalizedSegment = resolvedPath.length === 0 ? '' : `/${resolvedPath}`

  const mergedSearch = mergeSearch(target, {
    currentSearch:
      typeof options.currentSearch === 'string'
        ? new URLSearchParams(
            options.currentSearch.startsWith('?')
              ? options.currentSearch
              : `?${options.currentSearch}`,
          )
        : (options.currentSearch ?? new URLSearchParams()),
    preserveSearch: options.preserveSearch,
  })

  return `/${target.community}${normalizedSegment}${toSearchString(mergedSearch)}`
}

/** Reports whether active dsb route at the frontend shared boundary. */
export const isActiveDsbRoute = (pathname: string, target: TDsbRouteTarget): boolean => {
  const meta = parseDsbPathname(pathname)
  if (!meta) return false
  if (meta.community !== target.community) return false

  const targetPath = trimPath(target.path)
  const rawCurrent = meta.segments.join('/')
  const current = rawCurrent === 'overview' ? '' : rawCurrent

  return targetPath === ''
    ? current === ''
    : current === targetPath || current.startsWith(`${targetPath}/`)
}

/** Resolves a public community route without coupling Core to a router runtime. */
export const resolveCommunityRoute = (
  target: TCommunityRouteTarget,
  options: {
    currentSearch?: URLSearchParams | string
    preserveSearch?: boolean
  } = {},
): string => {
  const path = trimPath(target.path)
  const normalizedSegment = path.length === 0 ? '' : `/${path}`
  const currentSearch =
    typeof options.currentSearch === 'string'
      ? new URLSearchParams(options.currentSearch.replace(/^\?/, ''))
      : (options.currentSearch ?? new URLSearchParams())

  return `/${target.community}${normalizedSegment}${toSearchString(
    mergeSearch(target, { currentSearch, preserveSearch: options.preserveSearch }),
  )}`
}

/** Reports whether a public community target owns the current pathname. */
export const isActiveCommunityRoute = (
  pathname: string,
  target: TCommunityRouteTarget,
): boolean => {
  const current = trimPath(pathname)
  const expected = trimPath(`${target.community}/${target.path}`)
  return expected === current || (expected.length > 0 && current.startsWith(`${expected}/`))
}

export const DSB_ALLOWED_SEARCH_KEYS: readonly string[] = DSB_SEARCH_KEYS
