'use client'

import { type FC } from 'react'

import { getDevLogoFilePath, getDevLogoSrc } from '~/utils/icons'
import IconHub from '~/widgets/IconHub'
import type { TIconName } from '~/widgets/IconHub/icons'

import type { TDevLogoOption, TIconListOption } from '../spec'

type TProps = {
  item: TIconListOption
  iconClassName: string
}

const isDevLogoOption = (item: TIconListOption): item is TDevLogoOption => item.kind === 'dev'

const IconNode: FC<TProps> = ({ item, iconClassName }) => {
  if (isDevLogoOption(item)) {
    return (
      <span>
        <img
          src={getDevLogoSrc(getDevLogoFilePath(item.name))}
          alt=''
          draggable={false}
          className='size-5 object-contain'
        />
      </span>
    )
  }

  return (
    <span>
      <IconHub
        provider={item.provider}
        icon={item.name as TIconName}
        mode='sprite'
        size={4.5}
        className={iconClassName}
      />
    </span>
  )
}

export default IconNode
