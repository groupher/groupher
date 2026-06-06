import { m } from 'motion/react'
import type { FC } from 'react'

import { getMood, normalizeScore } from './helper'
import useSalon from './salon/face'

type TProps = {
  score: number
  active: boolean
}

const Face: FC<TProps> = ({ score, active }) => {
  const s = useSalon()
  const safeScore = normalizeScore(score)
  const mood = getMood(safeScore)
  const mouthPath = `M 16 32 Q 24 ${32 + mood.mouthCurve} 32 32`
  const browOpacity = safeScore >= 58 ? 0.42 : 0.66
  const leftBrowPath =
    safeScore >= 72
      ? 'M 15 18 Q 18 17 21 18'
      : safeScore <= 36
        ? 'M 14 17 L 21 19'
        : 'M 15 18 L 21 18'
  const rightBrowPath =
    safeScore >= 72
      ? 'M 27 18 Q 30 17 33 18'
      : safeScore <= 36
        ? 'M 27 19 L 34 17'
        : 'M 27 18 L 33 18'

  return (
    <m.div
      className={s.wrapper}
      style={{ left: `${safeScore}%` }}
      initial={false}
      animate={{ scale: active ? 1.04 : 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      aria-hidden='true'
    >
      <svg className='size-full' viewBox='0 0 48 48'>
        <m.circle
          cx='24'
          cy='24'
          r='21'
          fill={mood.color}
          stroke='rgba(255,255,255,0.92)'
          strokeWidth='2.4'
        />
        <m.path
          d={leftBrowPath}
          stroke={`rgba(17,24,39,${browOpacity})`}
          strokeWidth='2'
          strokeLinecap='round'
        />
        <m.path
          d={rightBrowPath}
          stroke={`rgba(17,24,39,${browOpacity})`}
          strokeWidth='2'
          strokeLinecap='round'
        />
        <m.circle cx='18' cy={23 + mood.eyeOffset} r='2.1' fill='rgba(17,24,39,0.74)' />
        <m.circle cx='30' cy={23 + mood.eyeOffset} r='2.1' fill='rgba(17,24,39,0.74)' />
        <m.path
          d={mouthPath}
          fill='transparent'
          stroke='rgba(17,24,39,0.72)'
          strokeWidth='2.6'
          strokeLinecap='round'
        />
      </svg>
    </m.div>
  )
}

export default Face
