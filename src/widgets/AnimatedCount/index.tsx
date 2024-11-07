import type { FC } from 'react'

import type { TActive, TSize, TSpace } from '~/spec'

import SIZE from '~/const/size'

import AnimatedCount from './AnimatedCount'

import useSalon from './salon'

export type TProps = {
  count?: number
  size?: TSize
  forceColor?: string
} & TActive &
  TSpace

const Count: FC<TProps> = ({
  count = 0,
  forceColor = '',
  size = SIZE.SMALL,
  active = false,
  ...spacing
}) => {
  const s = useSalon({ count, active, ...spacing })

  if (forceColor) {
    // console.log('## forceColor: ', forceColor)
  }

  return (
    <div className={s.wrapper}>
      <AnimatedCount count={count} size={size} active={active} />
    </div>
  )
}

export default Count
