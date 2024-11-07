import { useState } from 'react'
import { Waypoint } from 'react-waypoint'

import useSalon from '../salon/cover_image/scroll_bar'

export default () => {
  const s = useSalon()
  const [show, setShow] = useState(false)

  console.log('## show: ', show)

  return (
    <>
      <div className={s.tracker}>
        <Waypoint onEnter={() => setShow(true)} onLeave={() => setShow(false)} />
      </div>

      {show && (
        <div className={s.wrapper}>
          <div className={s.bar} />
          <div className={s.dot} />
          <div className={s.dot} />
          <div className={s.dot} />
          <div className={s.dot} />
        </div>
      )}
    </>
  )
}
