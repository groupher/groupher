import type { ReactNode } from 'react'

import useSalon, { cn } from './salon'

type TProps = {
  label: string
  icon: ReactNode
  value?: ReactNode
  active?: boolean
}

export default function HudItem({ label, icon, value, active = false }: TProps) {
  const s = useSalon()

  return (
    <div className={s.item} aria-label={label}>
      <span className={cn(s.iconBox, active && s.iconBoxActive)}>{icon}</span>
      {value != null && <span className={s.value}>{value}</span>}
    </div>
  )
}
