import type { FC } from 'react'

import ArrowSVG from '~/icons/Arrow'
import type { TColorName } from '~/spec'

import useSalon from '../salon/arrow_button/arrow'

type TProps = {
  color: TColorName
  leftLayout: boolean
  reverseColor: boolean

  up: boolean
  down: boolean
}

const Arrow: FC<TProps> = ({ leftLayout, up, down }) => {
  const s = useSalon()

  if (!leftLayout) {
    if (down)
      return (
        <span className={s.downArrow}>
          <ArrowSVG className={s.downArrowIcon} />
        </span>
      )
    if (up)
      return (
        <span className={s.upArrow}>
          <ArrowSVG className={s.upArrowIcon} />
        </span>
      )

    return (
      <span className={s.rightArrow}>
        <ArrowSVG className={s.rightArrowIcon} />
      </span>
    )
  }

  return (
    <span className={s.leftArrow}>
      <ArrowSVG className={s.leftArrowIcon} />
    </span>
  )
}

export default Arrow
