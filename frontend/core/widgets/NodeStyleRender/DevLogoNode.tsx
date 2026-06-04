'use client'

import NextImage from 'next/image'
import type { FC } from 'react'

import type { TNodeStyleDevValue } from '~/spec'
import { getDevLogoSrc } from '~/utils/icons'

type TProps = {
  value: TNodeStyleDevValue
  size: number
  className?: string
}

const DevLogoNode: FC<TProps> = ({ value, size, className }) => {
  return (
    <NextImage
      src={getDevLogoSrc(value.src)}
      width={size}
      height={size}
      alt=''
      unoptimized
      draggable={false}
      className={className}
    />
  )
}

export default DevLogoNode
