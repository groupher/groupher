'use client'

import { range } from 'ramda'
import type { FC } from 'react'
import SIZE from '~/const/size'
import type { TSizeTSM, TSpace } from '~/spec'

import useSalon, { cn } from './salon/lava_lamp_loading'

type TProps = TSpace & { size?: TSizeTSM; className?: string }

const LavaLampLoading: FC<TProps> = ({ size, className = '', ...spacing }) => {
  const s = useSalon({ ...spacing })

  // <Circle key={num} index={num} $color={primaryColor} />

  return (
    <div
      className={cn(s.wrapper, size === SIZE.TINY && 'scale-75', size === SIZE.SMALL && 'scale-90')}
    >
      <div className={s.container}>
        {range(0, 9).map((num) => (
          <span
            key={num}
            className={cn(
              s.circle,
              'animate-loading-move first:absolute first:top-0 first:left-0 first:animate-loading-grow last:absolute last:top-0 last:right-0 last:mr-0 last:animate-loading-grow last:animation-reverse',
              num === 2 || num === 6 ? 'w-3.5' : 'w-1',
            )}
            style={{ animationDelay: `${s.speedMap[num]}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export default LavaLampLoading
