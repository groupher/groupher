import type { FC } from 'react'

import useSalon, { cn } from '../salon/tech_stacks/holder_key'

type TProps = {
  name: string
  prefix: string
  className?: string
}

const HolderKey: FC<TProps> = ({ name, prefix, className = '' }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, className)}>
      <div className={s.prefix}>{prefix}</div>
      <div className={s.intro}>
        <span className={s.title}>{name}</span>
      </div>
    </div>
  )
}

export default HolderKey
