'use client'

import type { FC } from 'react'

import type { TNodeStyleIconValue } from '~/spec'
import IconHub from '~/widgets/IconHub'

type TProps = {
  value: TNodeStyleIconValue
  size: number
  className?: string
}

const IconNode: FC<TProps> = ({ value, size, className }) => {
  return (
    <IconHub
      provider={value.provider}
      icon={value.name}
      mode='mask'
      size={size / 4}
      className={className}
    />
  )
}

export default IconNode
