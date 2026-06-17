import type { ReactNode } from 'react'

import { IMAGE_TITLE, type TImageType } from './constant'
import useSalon from './salon'

type TProps = {
  type: TImageType
  action?: ReactNode
}

export default function ImageTitle({ type, action }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{IMAGE_TITLE[type]}</div>
      <div className={s.cn(s.line, action && s.lineWithAction)} />
      {action && <div className={s.action}>{action}</div>}
    </div>
  )
}
