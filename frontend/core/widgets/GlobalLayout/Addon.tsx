'use client'

import type { FC } from 'react'
// eslint-disable-next-line import/no-unresolved
import { Toaster } from 'sonner'

import useShortcut from '~/hooks/useShortcut'

import PriceWall from '~/unit/price-wall/Modal'
import UserListModal from '~/widgets/UserListModal'

const Addon: FC = () => {
  // const { isMobile } = useMobileDetect()

  useShortcut('Control+P', () => console.log('## # Ctrl P pressed'))

  return (
    <>
      <PriceWall />
      <UserListModal />
      <Toaster position="top-center" />
    </>
  )
}

export default Addon
