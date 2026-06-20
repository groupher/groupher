'use client'

import type { TSpace } from '~/spec'

import useSalon, { cn } from './salon/table'
import { cnMerge } from '~/css'

const randDelay = () => ({
  animationDelay: `${Math.random() * 0.8}s`,
})

type TProps = TSpace & { className?: string }

export default function TableLoading({ className = '', ...spacing }: TProps) {
  const s = useSalon(spacing)

  return (
    <div className={cnMerge(s.wrapper, className)}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={`row-${i + 1}`} className={s.row}>
          <div style={randDelay()} className={cn(s.item, 'h-4 w-60')} />
          <div style={randDelay()} className={cn(s.item, 'w-16 h-4')} />
          <div style={randDelay()} className={cn(s.item, 'w-20 h-4')} />
          <div style={randDelay()} className={cn(s.item, 'h-4 w-30')} />
          <div style={randDelay()} className={cn(s.item, 'h-4 w-30')} />
          <div style={randDelay()} className={cn(s.item, 'h-4 w-30')} />
          <div style={randDelay()} className={cn(s.item, 'w-20 h-4 ml-auto')} />
        </div>
      ))}
    </div>
  )
}
