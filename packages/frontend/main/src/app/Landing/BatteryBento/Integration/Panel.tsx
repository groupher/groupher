import type { FC } from 'react'

import Header from './Header'
import Sidebar from './Sidebar'
import EmbedScript from './EmbedScript'

import useSalon, { cn } from '../../salon/battery_bento/integration/panel'

type TProps = {
  hovering: boolean
}

const Panel: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.block, hovering && s.mask)}>
        <Header />

        <div className={cn(s.bar, 'left-5 top-10 h-3.5 opacity-50')} />
        <div className={cn(s.bar, 'left-5 top-16 h-1.5 opacity-20')} />
        <div className={cn(s.bar, 'left-5 top-20 h-1.5 w-16 opacity-15')} />

        <div className={cn(s.bar, s.redBg, 'left-5 top-24 h-3 w-10 opacity-50')} />

        <div className={cn(s.bar, 'right-20 top-10 h-14 w-12 opacity-15')} />
        <div className={cn(s.bar, 'right-4 top-10 h-16 w-12 opacity-10')} />

        <EmbedScript />
        <Sidebar hovering={hovering} />
      </div>
    </div>
  )
}

export default Panel
