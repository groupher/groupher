'use client'

import type { CSSProperties, FC } from 'react'

import FileTextSVG from '~/icons/FileText'
import type { TMarkerIconValue } from '~/spec'
import { getDevLogoSrc } from '~/utils/icons'
import IconHub from '~/widgets/IconHub'
import type { TIconName } from '~/widgets/IconHub/icons'

type TProps = {
  value: TMarkerIconValue
  size: number
  iconColorClass: string
  strokeIconClass: string
  color?: string
}

const IconNode: FC<TProps> = ({ value, size, iconColorClass, strokeIconClass, color }) => {
  const pixelSize = size * 4
  const colorStyle: CSSProperties | undefined = color ? { color } : undefined

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

  if (value.name === 'file-text') {
    return (
      <FileTextSVG
        width={pixelSize}
        height={pixelSize}
        className={strokeIconClass}
        style={colorStyle}
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
      style={color ? { backgroundColor: color } : undefined}
    />
  )
}

export default IconNode
