/*
 *
 * Tabs
 *
 */

import useMobileDetect from '@groupher/use-mobile-detect-hook'
import { memo, type FC } from 'react'

import VIEW from '~/const/view'

import DesktopView from './DesktopView'
import DrawerView from './DrawerView'
import type { TProps } from './spec'

const Tabs: FC<TProps> = (props) => {
  const { isMobile } = useMobileDetect()
  const { view = 'auto' } = props

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

export type { TProps, TSlipBarPos, TTabItem, TTabsOnChange, TTabsView } from './spec'
export default memo(Tabs)
