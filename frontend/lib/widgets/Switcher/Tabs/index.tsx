/*
 *
 * Tabs
 *
 */

import { memo } from 'react'
import useMobileDetect from '@groupher/use-mobile-detect-hook'

import VIEW from '~/const/view'

import DesktopView from './DesktopView'
import DrawerView from './DrawerView'

const Tabs = (props) => {
  const { isMobile } = useMobileDetect()
  const { view } = props

  const curMedia = isMobile ? VIEW.MOBILE : VIEW.DESKTOP
  const curView = view === 'auto' ? curMedia : view

  switch (curView) {
    case VIEW.DRAWER: {
      return <DrawerView {...props} />
    }

    default: {
      return <DesktopView {...props} />
    }
  }
}

export default memo(Tabs)
