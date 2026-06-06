import type { ReactNode } from 'react'

import useSalon from './salon'

type TImageType = 'primary' | 'secondary'

const IMAGE_TITLE: Record<TImageType, string> = {
  primary: 'Primary image',
  secondary: 'Secondary image',
}

type TProps = {
  type: TImageType
  action?: ReactNode
}

export default function ImageTitle({ type, action }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{IMAGE_TITLE[type]}</div>
      <div className={s.line} />
      {action && <div className={s.action}>{action}</div>}
    </div>
  )
}
