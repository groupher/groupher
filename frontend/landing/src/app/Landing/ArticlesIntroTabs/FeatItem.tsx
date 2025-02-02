import type { FC } from 'react'

import type { TColor } from '~/spec'
import CheckSVG from '~/icons/CheckBold'
// import CheckSVG from '~/icons/CheckCircle'

import useSalon from '../salon/articles_intro_tabs/feat_item'

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
