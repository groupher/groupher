'use client'

import NextImage from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import NextScript from 'next/script'
import { type ComponentType, type ReactNode, useMemo } from 'react'

import {
  isActiveDsbRoute,
  isActiveCommunityRoute,
  PlatformProvider,
  resolveCommunityRoute,
  resolveDsbRoute,
  type TPlatformImageProps,
  type TPlatformScriptProps,
} from '~/platform'

import MainPlatformLink from './Link'

type TProps = {
  children: ReactNode
}

export default function NextPlatformProvider({ children }: TProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const search = searchParams.toString()

  const navi = useMemo(() => {
    const searchString = search ? `?${search}` : ''
    const searchParamsObj = new URLSearchParams(search)

    return {
      dsbRootSegment: 'dashboard' as const,
      location: {
        pathname,
        search: searchString,
        searchParams: searchParamsObj,
      },
      to: (target, options) => {
        const href =
          target.app === 'community'
            ? resolveCommunityRoute(target, {
                currentSearch: searchParamsObj,
                preserveSearch: options?.preserveSearch,
              })
            : target.app === 'dsb'
              ? resolveDsbRoute(target, {
                  rootSegment: 'dashboard',
                  currentSearch: searchParamsObj,
                  preserveSearch: options?.preserveSearch,
                })
              : null
        if (!href) return
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
      isActive: (target) =>
        target.app === 'community'
          ? isActiveCommunityRoute(pathname, target)
          : target.app === 'dsb' && isActiveDsbRoute(pathname, target, 'dashboard'),
    }
  }, [pathname, search, router])

  return (
    <PlatformProvider
      value={{
        navi,
        components: {
          Image: NextImage as ComponentType<TPlatformImageProps>,
          Link: MainPlatformLink,
          Script: NextScript as ComponentType<TPlatformScriptProps>,
        },
      }}
    >
      {children}
    </PlatformProvider>
  )
}
