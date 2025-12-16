'use client'

import CommunityDigest from '~/widgets/CommunityDigest'

import useSalon from './salon'

export default ({ children }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <CommunityDigest />
      <div className={s.content}>{children}</div>
    </div>
  )
}
