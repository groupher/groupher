'use client'

import { type FC } from 'react'

import IconHub from '~/widgets/IconHub'
import type { TIconName } from '~/widgets/IconHub/icons'

import type { TIconOption } from '../spec'

type TProps = {
  item: TIconOption
  iconClassName: string
}

const IconNode: FC<TProps> = ({ item, iconClassName }) => {
  return (
    <span>
      <IconHub
        provider={item.provider}
        icon={item.name as TIconName}
        size={4.5}
        className={iconClassName}
      />
    </span>
  )
}

export default IconNode
