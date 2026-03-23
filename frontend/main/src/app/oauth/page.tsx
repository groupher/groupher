'use client'

import { Suspense } from 'react'

import dynamic from 'next/dynamic'

const OauthHinter = dynamic(() => import('~/unit/oauth'), {
  ssr: false,
})

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OauthHinter />
    </Suspense>
  )
}
