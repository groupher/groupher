'use client'

import CommunityDigest from '~/unit/community-digest'

import useSalon from './salon'

export default function Client({ children }) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <CommunityDigest />
      <div className={s.content}>{children}</div>
    </div>
  )
}
