'use client'

import { type ReactNode, Suspense } from 'react'

import NextPlatformProvider from './nextPlatform'
import StaticNextPlatformProvider from './staticNextPlatform'

export default function NextPlatformBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<StaticNextPlatformProvider>{children}</StaticNextPlatformProvider>}>
      <NextPlatformProvider>{children}</NextPlatformProvider>
    </Suspense>
  )
}
