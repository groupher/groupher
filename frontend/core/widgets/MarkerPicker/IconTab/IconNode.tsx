'use client'

import { type FC } from 'react'

import { getDevLogoFilePath, getDevLogoSrc } from '~/utils/icons'
import IconHub from '~/widgets/IconHub'
import type { TIconName } from '~/widgets/IconHub/icons'

import type { TDevLogoOption, TIconListOption } from '../spec'

type TProps = {
  item: TIconListOption
  iconClassName: string
  color?: string
}

const isDevLogoOption = (item: TIconListOption): item is TDevLogoOption => item.kind === 'dev'

const IconNode: FC<TProps> = ({ item, iconClassName, color }) => {
  if (isDevLogoOption(item)) {
    return (
      <img
        src={getDevLogoSrc(getDevLogoFilePath(item.name))}
        alt=''
        draggable={false}
        className='block size-5 object-contain'
      />
    )
  }

  return (
    <IconHub
      provider={item.provider}
      icon={item.name as TIconName}
      mode='sprite'
      size={4.5}
      className={iconClassName}
      style={color ? { color } : undefined}
    />
  )
}

export default IconNode
