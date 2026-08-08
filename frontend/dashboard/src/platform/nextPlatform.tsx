'use client'

import NextImage from 'next/image'
import NextLink from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import NextScript from 'next/script'
import { type ComponentType, type ReactNode, useMemo } from 'react'

import {
  isActiveDsbRoute,
  PlatformProvider,
  resolveDsbRoute,
  type TPlatformImageProps,
  type TPlatformLinkProps,
  type TPlatformScriptProps,
} from '~/platform'

type TProps = {
  children: ReactNode
}

export const NextPlatformProvider = ({ children }: TProps): ReactNode => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const search = searchParams.toString()

  const navi = useMemo(() => {
    const searchString = search ? `?${search}` : ''
    const searchParamsObj = new URLSearchParams(search)

    return {
      location: {
        pathname,
        search: searchString,
        searchParams: searchParamsObj,
      },
      to: (target, options) => {
        const href = resolveDsbRoute(target, {
          rootSegment: 'dashboard',
          currentSearch: searchParamsObj,
          preserveSearch: options?.preserveSearch,
        })
        if (options?.replace) {
          void router.replace(href)
        } else {
          void router.push(href)
        }
      },
      push: (href, options) => {
        void router.push(href, options)
      },
      replace: (href, options) => {
        void router.replace(href, options)
      },
      back: () => {
        router.back()
      },
      forward: () => {
        router.forward()
      },
      refresh: () => {
        router.refresh()
      },
      prefetch: async (href) => {
        await router.prefetch(href)
      },
      isActive: (target) => isActiveDsbRoute(pathname, target),
    }
  }, [pathname, search, router])

  return (
    <PlatformProvider
      value={{
        navi,
        components: {
          Image: NextImage as ComponentType<TPlatformImageProps>,
          Link: NextLink as ComponentType<TPlatformLinkProps>,
          Script: NextScript as ComponentType<TPlatformScriptProps>,
        },
      }}
    >
      {children}
    </PlatformProvider>
  )
}

export default NextPlatformProvider
