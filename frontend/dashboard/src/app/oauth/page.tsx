'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const OauthHinter = dynamic(() => import('~/unit/Oauth'), {
  ssr: false,
})

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OauthHinter />
    </Suspense>
  )
}
