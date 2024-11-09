import { useRef } from 'react'
import { useInView } from 'framer-motion'
import { range } from 'ramda'

import { MAX_INTRO_IMAGES_COUNT } from './DesktopDevice'
import useSalon, { cn } from '../salon/cover_image/scroll_bar'

type TProps = {
  imageIndex: number
  onChange: (index: number) => void
}

export default ({ imageIndex, onChange }: TProps) => {
  const s = useSalon()
  const ref = useRef(null)
  const isInView = useInView(ref)

  return (
    <>
      <div ref={ref} className={s.tracker} />

      {isInView && (
        <div className={s.wrapper}>
          {range(0, MAX_INTRO_IMAGES_COUNT).map((i) => {
            const active = i === imageIndex
            return (
              <div key={i} className={cn(s.dot, active && s.dotActive)}>
                {!active && <div className={s.dotBox} onClick={() => onChange(i)} />}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
