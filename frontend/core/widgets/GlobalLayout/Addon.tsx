'use client'

import type { FC } from 'react'

import useShortcut from '~/hooks/useShortcut'

import PriceWall from '~/unit/PriceWall/Modal'
import UserListModal from '~/widgets/UserListModal'

const Addon: FC = () => {
  // const { isMobile } = useMobileDetect()

  useShortcut('Control+P', () => console.log('## # Ctrl P pressed'))

  return (
    <>
      <PriceWall />
      <UserListModal />
    </>
  )
}

export default Addon
