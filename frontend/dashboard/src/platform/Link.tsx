import NextLink from 'next/link'

import { resolveDsbRoute, type TPlatformLinkProps } from '~/platform'
import { usePlatform } from '~/platform'

export default function NextPlatformLink({
  children,
  route,
  href,
  preserveSearch,
  ...props
}: TPlatformLinkProps) {
  const { navi } = usePlatform()
  const finalHref = route
    ? resolveDsbRoute(route, {
        rootSegment: 'dashboard',
        currentSearch: navi.location.searchParams,
        preserveSearch,
      })
    : href

  if (!finalHref) throw new Error('PlatformLink requires either href or route')

  return (
    <NextLink href={finalHref} {...props}>
      {children}
    </NextLink>
  )
}
