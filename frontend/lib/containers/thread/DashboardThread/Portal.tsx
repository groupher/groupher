import type { FC, ReactNode } from 'react'

import useSalon from './salon/portal'

type TProps = {
  title: string
  desc?: ReactNode
  withDivider?: boolean
}

const Portal: FC<TProps> = ({ title, desc = null, withDivider = true }) => {
  const s = useSalon()

  return (
    <div>
      <h3 className={s.title}>{title}</h3>

      {desc && <p className={s.desc}>{desc}</p>}
      {withDivider && <div className={s.divider} />}
    </div>
  )
}

export default Portal
