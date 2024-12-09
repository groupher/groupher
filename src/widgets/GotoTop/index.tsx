/*
 *
 * GotoTop
 *
 */

import { type FC, memo } from 'react'

import { scrollToHeader, scrollDrawerToTop } from '~/dom'

import AirBalloonSVG from '~/widgets/Icons/AirBalloon'

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
