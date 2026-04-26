/*
 *
 * GotoTop
 *
 */

import { type FC, memo } from 'react'

import { scrollDrawerToTop, scrollToHeader } from '~/dom'
import AirBalloonSVG from '~/icons/AirBalloon'

import useSalon from './salon'

export type TProps = {
  type?: 'body' | 'drawer'
}

const GotoTop: FC<TProps> = ({ type = 'body' }) => {
  const s = useSalon()
  const handler = type === 'body' ? scrollToHeader : scrollDrawerToTop

  return (
    <div className={s.wrapper} onClick={handler}>
      <AirBalloonSVG className={s.icon} />
    </div>
  )
}

export default memo(GotoTop)
