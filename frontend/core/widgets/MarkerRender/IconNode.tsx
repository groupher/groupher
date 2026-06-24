'use client'

import type { FC } from 'react'

import type { TMarkerIconValue } from '~/spec'
import { getDevLogoSrc } from '~/utils/icons'
import IconHub from '~/widgets/IconHub'
import type { TIconName } from '~/widgets/IconHub/icons'

type TProps = {
  value: TMarkerIconValue
  size: number
  iconColorClass: string
}

const IconNode: FC<TProps> = ({ value, size, iconColorClass }) => {
  const pixelSize = size * 4

  if (value.provider === 'dev') {
    return (
      <img
        src={getDevLogoSrc(value.src)}
        width={pixelSize}
        height={pixelSize}
        alt=''
        draggable={false}
        className='block object-contain'
      />
    )
  }

  return (
    <IconHub
      provider={value.provider}
      icon={value.name as TIconName}
      mode='mask'
      size={size}
      className={iconColorClass}
    />
  )
}

export default IconNode
