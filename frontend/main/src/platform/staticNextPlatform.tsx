'use client'

import NextImage from 'next/image'
import NextLink from 'next/link'
import NextScript from 'next/script'
import type { ComponentType, ReactNode } from 'react'

import {
  PlatformProvider,
  type TPlatform,
  type TPlatformImageProps,
  type TPlatformLinkProps,
  type TPlatformScriptProps,
} from '~/platform'

const staticPlatform: TPlatform = {
  components: {
    Image: NextImage as ComponentType<TPlatformImageProps>,
    Link: NextLink as ComponentType<TPlatformLinkProps>,
    Script: NextScript as ComponentType<TPlatformScriptProps>,
  },
  navi: {
    location: {
      pathname: '',
      search: '',
      searchParams: new URLSearchParams(),
    },
    to: () => {},
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: async () => {},
    isActive: () => false,
  },
}

export default function StaticNextPlatformProvider({ children }: { children: ReactNode }) {
  return <PlatformProvider value={staticPlatform}>{children}</PlatformProvider>
}
