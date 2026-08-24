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

type TTanStackNavigate = ReturnType<typeof useNavigate>
type TTanStackNavigateOptions = Parameters<TTanStackNavigate>[0]
type TTanStackRouter = ReturnType<typeof useTanStackRouter>
type TTanStackPreloadRouteOptions = Parameters<TTanStackRouter['preloadRoute']>[0]

const navigateToResolvedPath = (
  navigate: TTanStackNavigate,
  options: { to: string; replace?: boolean; resetScroll?: boolean },
): void => {
  void navigate(options as TTanStackNavigateOptions)
}

const preloadResolvedPath = async (router: TTanStackRouter, href: string): Promise<void> => {
  await router.preloadRoute({ to: href } as TTanStackPreloadRouteOptions)
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
      dsbRootSegment: 'dash' as const,
      location: {
        pathname: currentPathname,
        search,
        searchParams,
      },
      to: (target, options) => {
        if (target.app !== 'dsb') return
        const href = resolveDsbRoute(target, {
          rootSegment: 'dash',
          currentSearch: searchParams,
          preserveSearch: options?.preserveSearch,
        })
        navigateToResolvedPath(navigate, {
          to: href,
          replace: options?.replace,
        })
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
        await preloadResolvedPath(router, href)
      },
      isActive: (target) =>
        target.app === 'dsb' && isActiveDsbRoute(currentPathname, target, 'dash'),
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
