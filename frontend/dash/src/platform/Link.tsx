import type { MouseEvent } from 'react'

import type { TPlatformLinkProps } from '~/platform'
import { usePlatform } from '~/platform'

const isModifiedClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0

export default function TanStackPlatformLink({
  children,
  href,
  onClick,
  onFocus,
  onMouseEnter,
  prefetch,
  replace,
  scroll,
  target,
  ...props
}: TPlatformLinkProps) {
  const { navi } = usePlatform()
  const isInternal = href.startsWith('/')

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || !isInternal || target || isModifiedClick(event)) return

    event.preventDefault()
    if (replace) {
      navi.replace(href, { scroll })
    } else {
      navi.push(href, { scroll })
    }
  }

  const handlePrefetch = () => {
    if (prefetch && isInternal) void navi.prefetch(href)
  }

  return (
    <a
      {...props}
      href={href}
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
