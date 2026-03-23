'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { DSB_SEG } from '~/const/route'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import type { TBreadcrumbItem, TTransKey } from '~/spec'
import useCommunity from '~/stores/community/hooks'

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

const joinPath = (...parts: string[]) =>
  '/' +
  parts
    .filter(Boolean)
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .join('/')

const pickBestChild = (relative: string, children: TDsbCrumbNode[]): TDsbCrumbNode | null => {
  const candidates = children.filter((c) => relative.startsWith(`/${c.seg}`))
  if (!candidates.length) return null
  candidates.sort((a, b) => b.seg.length - a.seg.length)
  return candidates[0]
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

export default function useDsbCrumbItems(root: TDsbCrumbNode): TBreadcrumbItem[] {
  const pathname = usePathname()
  const { slug } = useCommunity()
  const searchString = useURLSearchParams()

  return useMemo(() => {
    if (!pathname || !slug) return []

    const idx = pathname.indexOf(`/${DSB_SEG}`)
    if (idx === -1) return []

    const fromDashboard = pathname.slice(idx) // /dashboard/xxx
    const relative = fromDashboard.slice(`/${DSB_SEG}`.length) || '/' // /third-part/xxx

    if (!relative.startsWith(`/${root.seg}`)) return []

    // cover page defaults to the first child
    const isOnRoot = relative === `/${root.seg}` || relative === `/${root.seg}/`
    const firstChildSeg = root.children?.[0]?.seg
    const effectiveRelative = isOnRoot && firstChildSeg ? `/${firstChildSeg}` : relative

    const chain = buildActiveChain(effectiveRelative, root)

    return chain.map((node, i) => {
      const to = node.toSeg ?? node.seg
      const full = `${joinPath(slug, DSB_SEG, to)}${searchString}`
      const isLast = i === chain.length - 1
      return { title: node.title, path: isLast ? '' : full }
    })
  }, [pathname, slug, root, searchString])
}
