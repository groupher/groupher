import NextLink from 'next/link'

import {
  resolveCommunityRoute,
  resolveDsbRoute,
  type TPlatformLinkProps,
  usePlatform,
} from '~/platform'

export default function NextPlatformLink({
  children,
  route,
  href,
  preserveSearch,
  previewId,
  ...props
}: TPlatformLinkProps) {
  const { navi } = usePlatform()
  const finalHref =
    route?.app === 'community'
      ? resolveCommunityRoute(route, {
          currentSearch: navi.location.searchParams,
          preserveSearch,
        })
      : route?.app === 'dsb'
        ? resolveDsbRoute(route, {
            rootSegment: 'dashboard',
            currentSearch: navi.location.searchParams,
            preserveSearch,
          })
        : href

  if (!finalHref) throw new Error('PlatformLink requires either href or route')

  return (
    <NextLink
      href={finalHref}
      {...props}
      data-preview-id={previewId === undefined ? undefined : String(previewId)}
    >
      {children}
    </NextLink>
  )
}
