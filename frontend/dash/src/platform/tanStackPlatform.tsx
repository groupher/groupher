'use client'

import { useLocation, useNavigate, useRouter as useTanStackRouter } from '@tanstack/react-router'
import { type ReactNode, useMemo } from 'react'

import { isActiveDsbRoute, PlatformProvider, resolveDsbRoute } from '~/platform'

import NativePlatformImage from './Image'
import TanStackPlatformLink from './Link'
import NativePlatformScript from './Script'

type TProps = {
  children: ReactNode
}

export const TanStackPlatformProvider = ({ children }: TProps): ReactNode => {
  const location = useLocation()
  const navigate = useNavigate()
  const router = useTanStackRouter()
  const search =
    typeof location.search === 'string'
      ? location.search
      : new URLSearchParams(location.search).toString()

  const navi = useMemo(() => {
    const searchParams = new URLSearchParams(search)
    const currentPathname = location.pathname

    return {
      location: {
        pathname: currentPathname,
        search,
        searchParams,
      },
      to: (target, options) => {
        const href = resolveDsbRoute(target, {
          rootSegment: 'dash',
          currentSearch: searchParams,
          preserveSearch: options?.preserveSearch,
        })
        void navigate({
          to: href,
          replace: options?.replace,
        } as Parameters<typeof navigate>[0])
      },
      push: (href, options) => {
        void navigate({ resetScroll: options?.scroll !== false, to: href })
      },
      replace: (href, options) => {
        void navigate({ replace: true, resetScroll: options?.scroll !== false, to: href })
      },
      back: () => {
        window.history.back()
      },
      forward: () => {
        window.history.forward()
      },
      refresh: () => {
        void router.invalidate()
      },
      prefetch: async (href) => {
        await router.preloadRoute({ to: href } as Parameters<typeof router.preloadRoute>[0])
      },
      isActive: (target) => isActiveDsbRoute(currentPathname, target),
    }
  }, [location.pathname, search, navigate, router])

  return (
    <PlatformProvider
      value={{
        navi,
        components: {
          Image: NativePlatformImage,
          Link: TanStackPlatformLink,
          Script: NativePlatformScript,
        },
      }}
    >
      {children}
    </PlatformProvider>
  )
}

export default TanStackPlatformProvider
