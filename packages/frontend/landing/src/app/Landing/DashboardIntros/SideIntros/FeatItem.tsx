import type { FC } from 'react'

import type { TColor } from '~/spec'
import CheckSVG from '~/icons/CheckCircle'

import useSalon from '../../salon/dashboard_intros/side_intros/feat_item'

type TProps = {
  text?: string
} & TColor

const FeatItem: FC<TProps> = ({ text = '--', color }) => {
  const s = useSalon({ color })

  return (
    <div className={s.wrapper}>
      <CheckSVG className={s.icon} />
      <div className={s.text}>{text}</div>
    </div>
  )
}

export default FeatItem
