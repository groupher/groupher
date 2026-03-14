'use client'

import { Suspense } from 'react'

import dynamic from 'next/dynamic'

// import OauthHinter from '~/widgets/OauthHinter'

const OauthHinter = dynamic(() => import('~/widgets/OauthHinter'), {
  ssr: false,
})

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OauthHinter />
    </Suspense>
  )
}
