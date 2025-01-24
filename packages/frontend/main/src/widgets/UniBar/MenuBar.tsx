import type { ReactNode } from 'react'

import useSalon from './salon/menu_bar'

type TProps = {
  children: ReactNode
  onClick?: () => void
  active?: boolean
}

export default ({ children, active = false, onClick = console.log }: TProps) => {
  const s = useSalon({ active })

  return (
    <div className={s.wrapper} onClick={() => onClick()}>
      {children}
    </div>
  )
}
