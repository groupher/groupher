import { type FC, lazy, Suspense } from 'react'

import { isString } from '~/validator'

import useSalon from '../salon/tabs/tab_icon'
import type { TTabItem } from './spec'

type TProps = {
  item: TTabItem
  active: boolean
}

const LocalIcon = lazy(() => import('./LocalIcon'))

const TabIcon: FC<TProps> = ({ item, active }) => {
  const s = useSalon()
  const icon = isString(item) ? undefined : item.icon

  const IconCmp = icon && (
    <Suspense fallback={null}>
      <LocalIcon slug={icon as string} active={active} small={false} />
    </Suspense>
  )

  return <span className={s.wrapper}>{IconCmp}</span>
}

export default TabIcon
