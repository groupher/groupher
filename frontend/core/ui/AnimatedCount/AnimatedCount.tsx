import { type FC, useEffect, useRef, useState } from 'react'
import FlipNumbers from 'react-flip-numbers'

import SIZE from '~/const/size'
import useDidMount from '~/hooks/useDidMount'

import type { TProps } from '.'
import useSalon from './salon'
import { getFlipNumOffset, getFontSize } from './salon/metric'

const AnimatedCount: FC<TProps> = ({ count = 0, size = SIZE.SMALL, active = false }) => {
  const s = useSalon({ count, active })
  const didMount = useDidMount()
  const initialCountRef = useRef(count)
  const [useFlip, setUseFlip] = useState(false)

  const numSize = getFontSize(size)
  const offset = getFlipNumOffset(size)

  useEffect(() => {
    if (!didMount || useFlip) return
    if (count !== initialCountRef.current) {
      setUseFlip(true)
    }
  }, [count, didMount, useFlip])

  return (
    <div className={s.wrapper}>
      {!didMount || !useFlip ? (
        <span>{count}</span>
      ) : (
        <FlipNumbers
          height={numSize}
          width={numSize - offset}
          color='inherit'
          perspective={400}
          duration={0.8}
          numbers={String(count)}
          play
        />
      )}
    </div>
  )
}

export default AnimatedCount
