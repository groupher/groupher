'use client'

import { useLocation, useNavigate, useRouter as useTanStackRouter } from '@tanstack/react-router'
import { type ReactNode, useMemo } from 'react'

import { THREAD_PATH } from '~/const/thread'
import { isActiveCommunityRoute, RouteScopeProvider, resolveCommunityRoute } from '~/platform'

export default function CommunityRouteScopeProvider({ children }: { children: ReactNode }) {
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
        const previewId = options?.previewId === undefined ? null : String(options.previewId)
        const currentSegments = location.pathname.split('/').filter(Boolean)
        const currentCommunity = currentSegments[0]
        const currentThread = currentSegments.length === 2 ? currentSegments[1] : null
        const maskedTo =
          previewId && currentThread === THREAD_PATH.POST && href.includes(`/${THREAD_PATH.POST}/`)
            ? `/${currentCommunity}/${THREAD_PATH.POST}/previewer/${previewId}`
            : previewId &&
                currentThread === THREAD_PATH.CHANGELOG &&
                href.includes(`/${THREAD_PATH.CHANGELOG}/`)
              ? `/${currentCommunity}/${THREAD_PATH.CHANGELOG}/previewer/${previewId}`
              : previewId &&
                  currentThread === THREAD_PATH.KANBAN &&
                  href.includes(`/${THREAD_PATH.POST}/`)
                ? `/${currentCommunity}/${THREAD_PATH.KANBAN}/previewer/${THREAD_PATH.POST}/${previewId}`
                : href

        void navigate({
          to: maskedTo,
          mask: maskedTo === href ? undefined : { to: href },
          replace: options?.replace,
          resetScroll: options?.scroll !== false,
        } as never)
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

  return <RouteScopeProvider value={{ navi }}>{children}</RouteScopeProvider>
}
