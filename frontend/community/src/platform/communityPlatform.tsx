'use client'

import { useLocation, useNavigate, useRouter as useTanStackRouter } from '@tanstack/react-router'
import { type ReactNode, useMemo } from 'react'

import { isActiveCommunityRoute, PlatformProvider, resolveCommunityRoute } from '~/platform'

import CommunityImage from './Image'
import CommunityLink from './Link'
import CommunityScript from './Script'

export default function CommunityPlatformProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const router = useTanStackRouter()
  const search =
    typeof location.search === 'string'
      ? location.search
      : new URLSearchParams(location.search).toString()
  const navi = useMemo(() => {
    const searchParams = new URLSearchParams(search)
    return {
      location: { pathname: location.pathname, search, searchParams },
      to: (target, options) => {
        if (target.app !== 'community') return
        const href = resolveCommunityRoute(target, {
          currentSearch: searchParams,
          preserveSearch: options?.preserveSearch,
        })
        void navigate({
          to: href,
          replace: options?.replace,
          resetScroll: true,
        })
      },
      push: (href, options) => void navigate({ to: href, resetScroll: options?.scroll !== false }),
      replace: (href, options) =>
        void navigate({ to: href, replace: true, resetScroll: options?.scroll !== false }),
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh: () => void router.invalidate(),
      prefetch: async (href) => {
        await router.preloadRoute({ to: href } as Parameters<typeof router.preloadRoute>[0])
      },
      isActive: (target) =>
        target.app === 'community' && isActiveCommunityRoute(location.pathname, target),
    }
  }, [location.pathname, search, navigate, router])

  return (
    <PlatformProvider
      value={{
        navi,
        components: { Image: CommunityImage, Link: CommunityLink, Script: CommunityScript },
      }}
    >
      {children}
    </PlatformProvider>
  )
}
