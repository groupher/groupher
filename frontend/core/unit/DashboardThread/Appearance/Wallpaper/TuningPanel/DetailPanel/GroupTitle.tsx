import type { ReactNode } from 'react'

import useSalon from '../../salon/tuning_panel/detail_panel/group_title'

type Props = {
  children: ReactNode
}

export default function GroupTitle({ children }: Props) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{children}</div>
      <div className={s.line} />
    </div>
  )
}
