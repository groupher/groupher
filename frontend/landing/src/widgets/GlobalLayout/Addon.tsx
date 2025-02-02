'use client'

import type { FC } from 'react'
// eslint-disable-next-line import/no-unresolved
import { Toaster } from 'sonner'

import useShortcut from '~/hooks/useShortcut'

import Drawer from '~/containers/tool/Drawer'
import PriceWall from '~/widgets/PriceWall/Modal'
import UserListModal from '~/widgets/UserListModal'

const Addon: FC = () => {
  // const { isMobile } = useMobileDetect()

  useShortcut('Control+P', () => console.log('## # Ctrl P pressed'))

  return (
    <>
      <Drawer />
      <PriceWall />
      <UserListModal />
      <Toaster position="top-center" />
    </>
  )
}

export default Addon
