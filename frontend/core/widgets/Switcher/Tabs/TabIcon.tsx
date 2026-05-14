import { type FC, lazy, Suspense, useCallback } from 'react'

import { isString } from '~/validator'

import useSalon from '../salon/tabs/tab_icon'
import type { TTabItem } from './spec'

type TProps = {
  item: TTabItem
  clickableRef: {
    current: HTMLElement
  }
  active: boolean
}

const LocalIcon = lazy(() => import('./LocalIcon'))

const TabIcon: FC<TProps> = ({ item, clickableRef, active }) => {
  const s = useSalon()
  const icon = isString(item) ? undefined : item.icon

  const IconCmp = icon && (
    <Suspense fallback={null}>
      <LocalIcon slug={icon as string} active={active} small={false} />
    </Suspense>
  )

  const activateParentTab = useCallback(
    (e) => {
      e.stopPropagation()
      clickableRef.current.click()
    },
    [clickableRef],
  )

  return (
    <button type='button' className={s.wrapper} onClick={activateParentTab}>
      {IconCmp}
    </button>
  )
}

export default TabIcon
