import { m } from 'motion/react'
import type { FC } from 'react'

import { normalizeScore } from './helper'
import useSalon from './salon/bucket'
import type { TFeedbackBucket } from './spec'

type TProps = {
  bucket: TFeedbackBucket
}

const Bucket: FC<TProps> = ({ bucket }) => {
  const s = useSalon()
  const score = normalizeScore(bucket.score)
  const label = bucket.count > 99 ? '99+' : bucket.count

  return (
    <m.div
      className={s.wrapper}
      style={{
        left: `${score}%`,
        backgroundColor: `hsl(${Math.round((score / 100) * 120)}, 58%, 54%)`,
      }}
      initial={{ scale: 0.72, opacity: 0, y: 4 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      aria-hidden='true'
    >
      {label}
    </m.div>
  )
}

export default Bucket
