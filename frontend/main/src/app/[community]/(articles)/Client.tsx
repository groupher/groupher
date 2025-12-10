'use client'

import { Suspense } from 'react'
import CommunityDigest from '~/widgets/CommunityDigest'

import useSalon from './salon'

export default ({ children }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Suspense fallback={<div>loading ....</div>}>
        <CommunityDigest />
      </Suspense>
      <div className={s.content}>{children}</div>
    </div>
  )
}
