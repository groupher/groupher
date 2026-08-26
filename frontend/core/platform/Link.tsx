'use client'

import type { FocusEvent, MouseEvent } from 'react'

import type { TLinkProps } from './context'
import { useRouteScope } from './context'
import { resolveCommunityRoute, resolveDsbRoute } from './route'

const isModifiedClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0

export default function Link({
  children,
  route,
  href,
  onClick,
  onFocus,
  onMouseEnter,
  prefetch,
  previewId,
  replace,
  scroll,
  preserveSearch,
  target,
  ...props
}: TLinkProps) {
  const { navi } = useRouteScope()
  const finalHref = route
    ? route.app === 'community'
      ? resolveCommunityRoute(route, {
          currentSearch: navi.location.searchParams,
          preserveSearch,
        })
      : resolveDsbRoute(route, {
          rootSegment: navi.dsbRootSegment ?? 'dash',
          currentSearch: navi.location.searchParams,
          preserveSearch,
        })
    : href

  if (!finalHref) throw new Error('Link requires either href or route')
  const isInternal = finalHref.startsWith('/')

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || !isInternal || target || isModifiedClick(event)) return

    event.preventDefault()
    if (route) {
      navi.to(route, { preserveSearch, previewId, replace, scroll })
    } else if (replace) {
      navi.replace(finalHref, { scroll })
    } else {
      navi.push(finalHref, { scroll })
    }
  }

  const handlePrefetch = () => {
    if (prefetch && isInternal) void navi.prefetch(finalHref)
  }

  const handleFocus = (event: FocusEvent<HTMLAnchorElement>) => {
    onFocus?.(event)
    if (!event.defaultPrevented) handlePrefetch()
  }

  const handleMouseEnter = (event: MouseEvent<HTMLAnchorElement>) => {
    onMouseEnter?.(event)
    if (!event.defaultPrevented) handlePrefetch()
  }

  return (
    <a
      {...props}
      data-preview-id={previewId === undefined ? undefined : String(previewId)}
      href={finalHref}
      target={target}
      onClick={handleClick}
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
    >
      {children}
    </a>
  )
}
