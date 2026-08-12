import { useLocation, useNavigate, useRouter } from '@tanstack/react-router'
import { type ReactNode, useMemo } from 'react'

import { PlatformProvider } from '~/platform'

type Props = { children: ReactNode }

export default function ApplyPlatformProvider({ children }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const router = useRouter()
  const value = useMemo(
    () => ({
      navi: {
        location: {
          pathname: location.pathname,
          search: typeof location.search === 'string' ? location.search : '',
          searchParams: new URLSearchParams(
            typeof location.search === 'string' ? location.search : '',
          ),
        },
        to: (href: string, options?: { replace?: boolean }) =>
          void navigate({ to: href, replace: options?.replace }),
        push: (href: string) => void navigate({ to: href }),
        replace: (href: string) => void navigate({ to: href, replace: true }),
        back: () => window.history.back(),
        forward: () => window.history.forward(),
        refresh: () => void router.invalidate(),
        prefetch: async (href: string) => {
          await router.preloadRoute({ to: href })
        },
        isActive: (href: string) => location.pathname === href,
      },
      components: {
        Image: 'img',
        Link: 'a',
        Script: 'script',
      },
    }),
    [location.pathname, location.search, navigate, router],
  )

  return <PlatformProvider value={value as never}>{children}</PlatformProvider>
}
