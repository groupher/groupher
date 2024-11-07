import { useState } from 'react'
import { Waypoint } from 'react-waypoint'
import { range } from 'ramda'

import useSalon, { cn } from '../salon/cover_image/scroll_bar'

type TProps = {
  imageIndex: number
  onChange: (index: number) => void
}

export default ({ imageIndex, onChange }: TProps) => {
  const s = useSalon()
  const [show, setShow] = useState(false)

  return (
    <>
      <div className={s.tracker}>
        <Waypoint onEnter={() => setShow(true)} onLeave={() => setShow(false)} />
      </div>

      {show && (
        <div className={s.wrapper}>
          {range(0, 5).map((i) => {
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
