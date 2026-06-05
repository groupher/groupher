import type { ReactNode } from 'react'

import { cn } from '~/css'

import useSalon from './salon/group_item'

type TProps = {
  label: ReactNode
  children: ReactNode
  align?: 'center' | 'start'
}

export default function GroupItem({ label, children, align = 'center' }: TProps) {
  const s = useSalon()
  const isStart = align === 'start'

  return (
    <div className={cn(s.wrapper, isStart && s.wrapperStart)}>
      <div className={cn(s.label, isStart && s.labelStart)}>{label}</div>
      <div className={cn(s.content, isStart && s.contentStart)}>{children}</div>
    </div>
  )
}
