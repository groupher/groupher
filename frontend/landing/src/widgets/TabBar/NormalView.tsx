import { type FC, memo } from 'react'

import { sortByIndex } from '~/helper'
import Tabs from '~/widgets/Switcher/Tabs'

import type { TProps } from '.'

const NormalView: FC<TProps> = ({ source, active, onChange, size, withIcon }) => {
  const items = source.map((item) => ({
    ...item,
    icon: withIcon ? item.slug : '',
  }))

  return (
    <Tabs
      items={sortByIndex(items)}
      activeKey={active}
      onChange={onChange}
      size={size}
      noAnimation
    />
  )
}

export default memo(NormalView)
