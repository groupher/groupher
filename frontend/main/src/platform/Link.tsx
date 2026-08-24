'use client'

import NextLink from 'next/link'

import {
  resolveCommunityRoute,
  resolveDsbRoute,
  usePlatform,
  type TPlatformLinkProps,
} from '~/platform'

export default function MainPlatformLink({
  route,
  href,
  preserveSearch,
  previewId,
  ...props
}: TPlatformLinkProps) {
  const { navi } = usePlatform()
  const resolvedHref =
    route?.app === 'community'
      ? resolveCommunityRoute(route, {
          currentSearch: navi.location.searchParams,
          preserveSearch,
        })
      : route?.app === 'dsb'
        ? resolveDsbRoute(route, {
            rootSegment: navi.dsbRootSegment || 'dashboard',
            currentSearch: navi.location.searchParams,
            preserveSearch,
          })
        : href

  if (!resolvedHref) throw new Error('PlatformLink requires either href or route')

  return (
    <NextLink
      {...props}
      data-preview-id={previewId === undefined ? undefined : String(previewId)}
      href={resolvedHref}
    />
  )
}
