'use client'

import { useLocation, useNavigate, useRouter } from '@tanstack/react-router'
import { type FocusEvent, type MouseEvent, useMemo } from 'react'

import { resolveCommunityRoute, resolveDsbRoute } from './route'
import type { TLinkProps } from './types'

const isModifiedClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0

export default function Link({
  children,
  route,
  href,
  navigation,
  mask,
  onClick,
  onFocus,
  onMouseEnter,
  prefetch,
  preserveSearch,
  replace,
  scroll,
  target,
  ...props
}: TLinkProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const router = useRouter()
  const currentSearch = useMemo(() => new URLSearchParams(location.searchStr), [location.searchStr])
  const finalHref = route
    ? route.app === 'community'
      ? resolveCommunityRoute(route, { currentSearch, preserveSearch })
      : resolveDsbRoute(route, { currentSearch, preserveSearch })
    : href

  if (!finalHref) throw new Error('Link requires either href or route')

  const handleRouterNavigation = () => {
    void navigate({
      to: (mask?.to ?? finalHref) as never,
      mask: mask ? { to: mask.visibleHref as never } : undefined,
      replace,
      resetScroll: scroll !== false,
    } as never)
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || navigation !== 'router' || target || isModifiedClick(event)) {
      return
    }

    event.preventDefault()
    handleRouterNavigation()
  }

  const handlePrefetch = () => {
    if (navigation === 'router' && prefetch) {
      void router.preloadRoute({ to: (mask?.to ?? finalHref) as never } as never)
    }
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
      href={mask?.visibleHref ?? finalHref}
      target={target}
      onClick={handleClick}
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
    >
      {children}
    </a>
  )
}
