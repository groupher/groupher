'use client'

import type { FC } from 'react'

import { cnMerge } from '~/css'
import type { TMarkerIconValue } from '~/spec'
import { getDevLogoSrc } from '~/utils/icons'
import IconHub from '~/widgets/IconHub'
import type { TIconName } from '~/widgets/IconHub/icons'

type TProps = {
  value: TMarkerIconValue
  size: number
  className?: string
}

const IconNode: FC<TProps> = ({ value, size, className }) => {
  const pixelSize = size * 4

  if (value.provider === 'dev') {
    return (
      <img
        src={getDevLogoSrc(value.src)}
        width={pixelSize}
        height={pixelSize}
        alt=''
        draggable={false}
        className={cnMerge('block', className)}
      />
    )
  }

  return (
    <IconHub
      provider={value.provider}
      icon={value.name as TIconName}
      mode='mask'
      size={size}
      className={className}
    />
  )
}

export default IconNode
