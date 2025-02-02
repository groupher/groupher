import type { FC } from 'react'

import type { TColorName } from '~/spec'

import ArrowSVG from '~/icons/Arrow'

import useSalon from '../salon/arrow_button/arrow'

type TProps = {
  color: TColorName
  leftLayout: boolean
  reverseColor: boolean

  up: boolean
  down: boolean
}

const Arrow: FC<TProps> = ({ color, leftLayout, up, down }) => {
  const s = useSalon({ color })

  if (!leftLayout) {
    if (down) return <ArrowSVG className={s.downArrow} />
    if (up) return <ArrowSVG className={s.upArrow} />

    return <ArrowSVG className={s.rightArrow} />
  }

  return <ArrowSVG className={s.leftArrow} />
}

export default Arrow
