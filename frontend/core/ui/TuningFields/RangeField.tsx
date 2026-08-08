import type { ReactNode } from 'react'

import { cn } from './salon'
import useSalon from './salon'

type Props = {
  label: ReactNode
  children: ReactNode
  align?: 'center' | 'start'
}

export default function RangeField({ label, children, align = 'center' }: Props) {
  const s = useSalon()
  const isStart = align === 'start'

  return (
    <div className={cn(s.wrapper, isStart && s.wrapperStart)}>
      <div className={cn(s.label, isStart && s.labelStart)}>{label}</div>
      <div className={cn(s.content, isStart && s.contentStart)}>{children}</div>
    </div>
  )
}
