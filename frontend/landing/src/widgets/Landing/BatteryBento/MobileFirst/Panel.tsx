import type { FC } from 'react'

import Img from '~/Img'
import { mockUsers } from '~/mock'

import useSalon, { cn } from '../../salon/battery_bento/mobile_first/panel'
import ActionsMask from './ActionsMask'

type TProps = {
  hovering: boolean
}

const Panel: FC<TProps> = ({ hovering }) => {
  const s = useSalon()
  const users = mockUsers(6)

  return (
    <div className={cn(s.wrapper, hovering && '-rotate-2')}>
      <div className={s.phone}>
        <ActionsMask hovering={hovering} />
        <div className={s.brand}>
          <div className={s.logo} />
          Yr Brand
        </div>
        <div className={s.item}>
          <Img src={users[0].avatar} className={s.avatar} />
          <div className={s.post}>
            <div className={s.bar} />
            <div className={cn(s.bar, 'opacity-15')} />
          </div>
        </div>

        <div className={s.item}>
          <Img src={users[1].avatar} className={s.avatar} />
          <div className={s.post}>
            <div className={cn(s.bar, 'w-14')} />
            <div className={cn(s.bar, 'opacity-15')} />
          </div>
        </div>

        <div className={cn(s.item, 'opacity-80')}>
          <Img src={users[2].avatar} className={s.avatar} />
          <div className={s.post}>
            <div className={cn(s.bar, 'w-12')} />
            <div className={cn(s.bar, 'opacity-15')} />
          </div>
        </div>

        <div className={cn(s.item, 'opacity-65')}>
          <Img src={users[3].avatar} className={s.avatar} />
          <div className={s.post}>
            <div className={cn(s.bar, 'w-8')} />
            <div className={cn(s.bar, 'opacity-15 w-14')} />
          </div>
        </div>

        <div className={cn(s.item, 'opacity-50')}>
          <Img src={users[4].avatar} className={s.avatar} />
          <div className={s.post}>
            <div className={cn(s.bar, 'w-8')} />
            <div className={cn(s.bar, 'opacity-15')} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Panel
