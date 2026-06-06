import type { ReactNode } from 'react'

import useSalon from './salon/group_title'

type TProps = {
  children: ReactNode
}

export default function GroupTitle({ children }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{children}</div>
      <div className={s.line} />
    </div>
  )
}
