'use client'

import { dsbRoutes, parseDsbPathname, resolveDsbRoute, usePlatform } from '~/platform'
import type { TTabItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'

type TTabDef = Omit<TTabItem, 'href'> & { segment?: string; path?: string }

export type TDsbTabs = {
  segment: string
  items: readonly TTabDef[]
}

const stripSlash = (value: string): string => value.replace(/^\/+|\/+$/g, '')
const buildPath = (...parts: string[]): string => {
  return parts
    .flatMap((part) =>
      part
        .split('/')
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .join('/')
}

const resolveTabPath = (base: string, target: string): string => {
  const normalizedBase = stripSlash(base)
  const normalizedTarget = stripSlash(target)

  if (!normalizedTarget) return normalizedBase
  if (!normalizedBase) return normalizedTarget
  if (normalizedTarget === normalizedBase || normalizedTarget.startsWith(`${normalizedBase}/`)) {
    return normalizedTarget
  }

  return buildPath(normalizedBase, normalizedTarget)
}

const isActiveTabPath = (routeSegments: string[], targetPath: string): boolean => {
  if (!targetPath) return routeSegments.length === 0

  const currentPath = routeSegments.join('/')

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}

/** Exposes dsb tabs state and actions through the shared React hook boundary. */
export default function useDsbTabs(cfg: TDsbTabs): {
  items: TTabItem[]
  activeTab: string
} {
  const { navi } = usePlatform()
  const { slug: community } = useCommunity()
  const routeMeta = parseDsbPathname(navi.location.pathname)
  const rootSegment = routeMeta?.rootSegment ?? 'dashboard'
  const routeSegments = routeMeta?.segments ?? []
  const basePath = stripSlash(cfg.segment)
  const defaultTab = cfg.items[0]?.slug ?? ''

  const activeTab =
    cfg.items.find((it) =>
      isActiveTabPath(routeSegments, resolveTabPath(basePath, stripSlash(it.path ?? it.slug))),
    )?.slug ?? defaultTab

  const items: TTabItem[] = cfg.items.map((it) => {
    const { segment, slug, ...rest } = it
    const resolved = segment === undefined ? slug : segment
    const path = resolveTabPath(basePath, stripSlash(resolved))
    const target = dsbRoutes.section({ community, section: path, search: {} })

    const href = resolveDsbRoute(target, {
      rootSegment,
      currentSearch: navi.location.searchParams,
      preserveSearch: true,
    })

    return { ...rest, title: rest.title, slug, href }
  })

  return { items, activeTab }
}
