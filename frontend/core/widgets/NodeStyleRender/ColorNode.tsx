'use client'

import type { FC } from 'react'

import type { TNodeStyleColorValue } from '~/spec'

import useSalon from './salon'

type TProps = {
  value: TNodeStyleColorValue
  size: number
  className?: string
}

const ColorNode: FC<TProps> = ({ value, size, className }) => {
  const s = useSalon({
    color: value.color,
    className,
  })

  return (
    <span
      className={s.color}
      style={{
        width: size,
        height: size,
      }}
    />
  )
}

export default ColorNode
