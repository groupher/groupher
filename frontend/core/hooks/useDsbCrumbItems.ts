'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { DSB_SEG } from '~/const/route'
import useCommunity from '~/hooks/useCommunity'
import type { TBreadcrumbItem, TDsbCrumbItem } from '~/spec'

export default function useDsbCrumbItems(crumbs: TDsbCrumbItem[]): TBreadcrumbItem[] {
  const pathname = usePathname()
  const { slug } = useCommunity() // e.g. 'home'

  return useMemo(() => {
    if (!pathname || !slug || !crumbs.length) return []

    const base = `/${slug}/${DSB_SEG}` // /home/dashboard

    if (!pathname.startsWith(base)) return []

    const relative = pathname.slice(base.length) || '/' // /domain/custom

    const reversed = [...crumbs].reverse()
    const reversedIndex = reversed.findIndex((c) => relative.startsWith(`/${c.seg}`))

    if (reversedIndex === -1) return []

    const end = crumbs.length - reversedIndex

    return crumbs.slice(0, end).map((c, index, arr) => {
      const fullPath = `${base}/${c.seg}`

      return {
        title: c.title,
        path: index === arr.length - 1 ? '' : fullPath,
      }
    })
  }, [pathname, slug, crumbs])
}
