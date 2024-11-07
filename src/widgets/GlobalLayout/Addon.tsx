'use client'

import { type FC, Fragment } from 'react'
// eslint-disable-next-line import/no-unresolved
import { Toaster } from 'sonner'

import useShortcut from '~/hooks/useShortcut'

import Drawer from '~/containers/tool/Drawer'
import PriceWall from '~/widgets/PriceWall/Modal'
import UserListModal from '~/widgets/UserListModal'

// import { Drawer } from './dynamic'

const Addon: FC = () => {
  // const { isMobile } = useMobileDetect()

  useShortcut('Control+P', () => console.log('## # Ctrl P pressed'))

  return (
    <Fragment>
      {/* @ts-ignore */}
      {/* {!isMobile && <AbuseReport />} */}
      {/* @ts-ignore */}
      <Drawer />
      <PriceWall />
      <UserListModal />
      <Toaster position="top-center" />
      {/* @ts-ignore */}
    </Fragment>
  )
}

export default Addon
