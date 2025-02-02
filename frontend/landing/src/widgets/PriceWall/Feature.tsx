import type { FC } from 'react'

import type { TColor } from '~/spec'
import CheckSVG from '~/icons/Check'

import useSalon from './salon/feature'

type TProps = {
  title: string
} & TColor

const Feature: FC<TProps> = ({ title, color }) => {
  const s = useSalon({ color })

  return (
    <div className={s.wrapper}>
      <div className={s.iconBox}>
        <CheckSVG className={s.checkIcon} />
      </div>
      <div className={s.title}>{title}</div>
    </div>
  )
}

export default Feature
