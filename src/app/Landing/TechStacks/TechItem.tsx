import type { FC } from 'react'

import Img from '~/Img'
import useSalon, { cn } from '../salon/tech_stacks/tech_item'

type TProps = {
  path: string
  name: string
  iconSize?: string
}

const TechItem: FC<TProps> = ({ path, name, iconSize = 'size-8' }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.iconBox}>
        <Img src={`landing/stacks/${path}`} className={cn(s.techIcon, iconSize)} />
      </div>
      <div className={s.name}>{name}</div>
    </div>
  )
}

export default TechItem
