'use client'
import { useLocation } from '@tanstack/react-router'
import { useMemo, useRef } from 'react'

import { dsbRoutes, parseDsbPathname, resolveDsbRoute } from '~/platform'
import type { TBreadcrumbItem, TTransKey } from '~/spec'

export type TDsbCrumbNode = {
  title: TTransKey

  /**
   * Segment used for matching current pathname (route semantics).
   * Example: 'third-part/email'
   */
  seg: string

  /**
   * Segment used for navigation when clicking breadcrumb (link semantics).
   * If omitted, defaults to `seg`.
   * Example: for "绑定集成" you may match 'third-part' but link to 'integrations'.
   */
  toSeg?: string

  children?: TDsbCrumbNode[]
}

const matchSeg = (relative: string, seg: string): boolean => {
  const prefix = `/${seg}`
  return relative === prefix || relative.startsWith(`${prefix}/`)
}

const pickBestChild = (relative: string, children: TDsbCrumbNode[]): TDsbCrumbNode | null => {
  let best: TDsbCrumbNode | null = null

  for (const child of children) {
    if (!matchSeg(relative, child.seg)) continue
    if (!best || child.seg.length > best.seg.length) best = child
  }

  return best
}

const buildActiveChain = (relative: string, root: TDsbCrumbNode): TDsbCrumbNode[] => {
  const chain: TDsbCrumbNode[] = [root]
  let current: TDsbCrumbNode | null = root

  while (current?.children?.length) {
    const next = pickBestChild(relative, current.children)
    if (!next) break
    chain.push(next)
    current = next
  }

  return chain
}

/**
 * Resolves dashboard breadcrumbs from route segments and a declared crumb tree.
 *
 * Route matching (`seg`) and navigation target (`toSeg`) are intentionally
 * separate so product labels can keep stable breadcrumbs while individual pages
 * move under different dashboard URLs.
 */
export default function useDsbCrumbItems(root: TDsbCrumbNode): TBreadcrumbItem[] {
  const { pathname, searchStr } = useLocation()
  const routeMeta = parseDsbPathname(pathname)
  const community = routeMeta?.community ?? ''
  const search = new URLSearchParams(searchStr)
  const routeSegmentsKey = routeMeta?.segments.join('/') ?? ''
  const crumbCacheRef = useRef<TBreadcrumbItem[]>([])
  const lastCommunityRef = useRef<string | undefined>(undefined)

  const computed = useMemo(() => {
    if (!routeMeta || !community) return []

    const relative = routeMeta.segments.length ? `/${routeMeta.segments.join('/')}` : '/'

    if (!matchSeg(relative, root.seg)) return []

    // cover page defaults to the first child
    const isOnRoot = relative === `/${root.seg}` || relative === `/${root.seg}/`
    const firstChildSeg = root.children?.[0]?.seg
    const effectiveRelative = isOnRoot && firstChildSeg ? `/${firstChildSeg}` : relative

    const chain = buildActiveChain(effectiveRelative, root)
    return chain.map((node, i) => {
      const to = node.toSeg ?? node.seg
      const target = dsbRoutes.section({
        community,
        section: to,
      })
      const full = resolveDsbRoute(target, {
        currentSearch: search,
        preserveSearch: true,
      })
      const isLast = i === chain.length - 1
      return { title: node.title, path: isLast ? '' : full }
    })
  }, [community, root, routeSegmentsKey, searchStr])

  if (community !== lastCommunityRef.current) {
    crumbCacheRef.current = []
    lastCommunityRef.current = community
  }

  if (computed.length > 0) {
    crumbCacheRef.current = computed
  }

  return computed.length > 0 ? computed : crumbCacheRef.current
}
