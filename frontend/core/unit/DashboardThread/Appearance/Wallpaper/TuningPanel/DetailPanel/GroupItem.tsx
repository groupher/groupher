import type { ReactNode } from 'react'

import useSalon from '../../salon/tuning_panel/detail_panel/group_item'

type Props = {
  label: ReactNode
  children: ReactNode
}

export default function GroupItem({ label, children }: Props) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.label}>{label}</div>
      <div className={s.content}>{children}</div>
    </div>
  )
}
