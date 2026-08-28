import type { TResolvedRouteMask } from '../platform/types'

const toPathname = (href: string): string => {
  try {
    return new URL(href, 'https://groupher.localhost').pathname
  } catch {
    return ''
  }
}

const segmentsOf = (pathname: string): string[] => pathname.split('/').filter(Boolean)

/** Resolves a product preview into its private route and canonical visible URL. */
export const resolveCommunityPreviewMask = ({
  currentPathname,
  href,
  previewId,
}: {
  currentPathname: string
  href: string
  previewId?: string | number
}): TResolvedRouteMask | null => {
  if (previewId === undefined) return null

  const current = segmentsOf(currentPathname)
  const target = segmentsOf(toPathname(href))
  const normalizedPreviewId = String(previewId)

  if (current.length !== 2 || target.length !== 3) return null
  if (current[0] !== target[0] || target[2] !== normalizedPreviewId) return null

  const [community, currentThread] = current
  const [, targetThread] = target
  const privatePath =
    currentThread === 'kanban' && targetThread === 'post'
      ? `/${community}/kanban/previewer/post/${normalizedPreviewId}`
      : currentThread === targetThread &&
          (currentThread === 'post' || currentThread === 'changelog')
        ? `/${community}/${currentThread}/previewer/${normalizedPreviewId}`
        : null

  return privatePath ? { to: privatePath, visibleHref: href } : null
}
