'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

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
