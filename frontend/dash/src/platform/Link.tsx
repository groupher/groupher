import { Link as TanStackLink } from '@tanstack/react-router'
import type { MouseEvent } from 'react'

import { resolveDsbRoute, type TPlatformLinkProps } from '~/platform'
import { usePlatform } from '~/platform'

const isModifiedClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0

export default function TanStackPlatformLink({
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
}: TPlatformLinkProps) {
  const { navi } = usePlatform()
  const finalHref =
    route?.app === 'dsb'
      ? resolveDsbRoute(route, {
          rootSegment: 'dash',
          currentSearch: navi.location.searchParams,
          preserveSearch,
        })
      : href

  if (!finalHref) throw new Error('PlatformLink requires either href or route')

  const isInternal = finalHref.startsWith('/')

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || !isInternal || target || isModifiedClick(event)) return

    event.preventDefault()
    if (replace) {
      navi.replace(finalHref, { scroll })
    } else {
      navi.push(finalHref, { scroll })
    }
  }

  const handlePrefetch = () => {
    if (prefetch && isInternal) void navi.prefetch(finalHref)
  }

  if (!isInternal) {
    return (
      <a
        {...props}
        data-preview-id={previewId === undefined ? undefined : String(previewId)}
        href={finalHref}
        target={target}
        onClick={handleClick}
        onFocus={(event) => {
          onFocus?.(event)
          handlePrefetch()
        }}
        onMouseEnter={(event) => {
          onMouseEnter?.(event)
          handlePrefetch()
        }}
      >
        {children}
      </a>
    )
  }

  return (
    <TanStackLink
      {...props}
      data-preview-id={previewId === undefined ? undefined : String(previewId)}
      to={finalHref}
      target={target}
      onClick={onClick}
      preload={prefetch ? 'intent' : false}
      replace={replace}
    >
      {children}
    </TanStackLink>
  )
}
