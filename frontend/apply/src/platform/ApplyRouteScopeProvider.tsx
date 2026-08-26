import { useLocation, useNavigate, useRouter } from '@tanstack/react-router'
import { type ReactNode, useMemo } from 'react'

import {
  resolveCommunityRoute,
  resolveDsbRoute,
  RouteScopeProvider,
  type TRouteScope,
} from '~/platform'

type Props = { children: ReactNode }

export default function ApplyRouteScopeProvider({ children }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const router = useRouter()
  const value = useMemo<TRouteScope>(
    () => ({
      navi: {
        location: {
          pathname: location.pathname,
          search: typeof location.search === 'string' ? location.search : '',
          searchParams: new URLSearchParams(
            typeof location.search === 'string' ? location.search : '',
          ),
        },
        to: (target, options) => {
          const href =
            target.app === 'community'
              ? resolveCommunityRoute(target, {
                  currentSearch: new URLSearchParams(
                    typeof location.search === 'string' ? location.search : '',
                  ),
                  preserveSearch: options?.preserveSearch,
                })
              : resolveDsbRoute(target, {
                  rootSegment: 'dash',
                  currentSearch: new URLSearchParams(
                    typeof location.search === 'string' ? location.search : '',
                  ),
                  preserveSearch: options?.preserveSearch,
                })
          void navigate({ to: href, replace: options?.replace })
        },
        push: (href: string) => void navigate({ to: href }),
        replace: (href: string) => void navigate({ to: href, replace: true }),
        back: () => window.history.back(),
        forward: () => window.history.forward(),
        refresh: () => void router.invalidate(),
        prefetch: async (href: string) => {
          await router.preloadRoute({ to: href })
        },
        isActive: (target) =>
          target.app === 'community'
            ? location.pathname === resolveCommunityRoute(target)
            : location.pathname === resolveDsbRoute(target, { rootSegment: 'dash' }),
      },
    }),
    [location.pathname, location.search, navigate, router],
  )

  return <RouteScopeProvider value={value}>{children}</RouteScopeProvider>
}
