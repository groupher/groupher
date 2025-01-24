import type { FC } from 'react'

import type { TActive, TMenu } from '~/spec'

import useSalon, { ICONS } from './salon/icon'

type TProps = {
  type: TMenu
} & TActive

const Icon: FC<TProps> = ({ type }) => {
  const s = useSalon()

  const IconComp = ICONS[type] || ICONS.OTHER

  return (
    <div className={s.wrapper}>
      <IconComp className={s.icon} />
    </div>
  )
}

export default Icon
