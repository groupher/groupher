import { Link as TanStackLink, useNavigate } from '@tanstack/react-router'
import type { MouseEvent } from 'react'

import { THREAD_PATH } from '~/const/thread'
import { resolveCommunityRoute, usePlatform, type TPlatformLinkProps } from '~/platform'

const isModifiedClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0

export default function CommunityLink({
  children,
  route,
  href,
  onClick,
  prefetch,
  previewId,
  replace,
  scroll,
  target,
  ...props
}: TPlatformLinkProps) {
  const { navi } = usePlatform()
  const navigate = useNavigate()
  const finalHref =
    route?.app === 'community'
      ? resolveCommunityRoute(route, { currentSearch: navi.location.searchParams })
      : href
  if (!finalHref) throw new Error('PlatformLink requires either href or route')
  if (!finalHref.startsWith('/'))
    return (
      <a {...props} href={finalHref} target={target} onClick={onClick}>
        {children}
      </a>
    )

  const normalizedPreviewId = previewId === undefined ? null : String(previewId)
  const currentSegments = navi.location.pathname.split('/').filter(Boolean)
  const isPostList = currentSegments.length === 2 && currentSegments[1] === THREAD_PATH.POST
  const isChangelogList =
    currentSegments.length === 2 && currentSegments[1] === THREAD_PATH.CHANGELOG
  const isKanbanBoard = currentSegments.length === 2 && currentSegments[1] === THREAD_PATH.KANBAN
  const currentCommunity = currentSegments[0]
  const maskedTo =
    normalizedPreviewId && isPostList && finalHref.includes(`/${THREAD_PATH.POST}/`)
      ? `/${currentCommunity}/${THREAD_PATH.POST}/previewer/${normalizedPreviewId}`
      : normalizedPreviewId && isChangelogList && finalHref.includes(`/${THREAD_PATH.CHANGELOG}/`)
        ? `/${currentCommunity}/${THREAD_PATH.CHANGELOG}/previewer/${normalizedPreviewId}`
        : normalizedPreviewId && isKanbanBoard && finalHref.includes(`/${THREAD_PATH.POST}/`)
          ? `/${currentCommunity}/${THREAD_PATH.KANBAN}/previewer/${THREAD_PATH.POST}/${normalizedPreviewId}`
          : finalHref
  const resetScroll = scroll !== false

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || target || isModifiedClick(event)) return
    event.preventDefault()
    if (maskedTo !== finalHref) {
      void navigate({
        to: maskedTo,
        mask: { to: finalHref },
        replace,
        resetScroll: false,
      } as never)
    } else if (replace) navi.replace(finalHref, { scroll: resetScroll })
    else navi.push(finalHref, { scroll: resetScroll })
  }

  return (
    <TanStackLink
      {...props}
      data-preview-id={normalizedPreviewId ?? undefined}
      to={maskedTo}
      target={target}
      preload={prefetch ? 'intent' : false}
      replace={replace}
      onClick={handleClick}
      mask={maskedTo !== finalHref ? { to: finalHref } : undefined}
    >
      {children}
    </TanStackLink>
  )
}
