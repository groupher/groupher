/*
 *
 * GotoTop
 *
 */

import { type FC, memo } from 'react'

import { scrollDrawerToTop, scrollToHeader } from '~/dom'
import AirBalloonSVG from '~/icons/AirBalloon'

import useSalon from './salon'

type TProps = {
  type?: 'body' | 'drawer'
}

const GotoTop: FC<TProps> = ({ type = 'body' }) => {
  const s = useSalon()
  const handler = type === 'body' ? scrollToHeader : scrollDrawerToTop

  return (
    <button type='button' className={s.wrapper} onClick={handler}>
      <AirBalloonSVG className={s.icon} />
    </button>
  )
}

export default memo(GotoTop)
