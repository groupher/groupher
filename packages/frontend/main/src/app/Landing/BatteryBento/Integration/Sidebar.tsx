import type { FC } from 'react'

import { mockUsers } from '~/mock'

import Img from '~/widgets/Img'

import useSalon, { cn } from '../../salon/battery_bento/integration/sidebar'

type TProps = {
  hovering: boolean
}

const Sidebar: FC<TProps> = ({ hovering }) => {
  const s = useSalon()
  const users = mockUsers(3)

  return (
    <div className={cn(s.wrapper, hovering ? 'right-2.5 opacity-100' : '-right-5')}>
      <Img className={cn(s.avatar, 'top-8 -left-5')} src={users[0].avatar} />
      <Img className={cn(s.avatar, 'top-20 left-3')} src={users[1].avatar} />
      <Img className={cn(s.avatar, 'top-16 -left-6')} src={users[2].avatar} />

      <div className={cn(s.bar, 'top-2')} />
      <div className={cn(s.bar, 'top-5 h-1 w-14 opacity-20')} />

      <div className={cn(s.bar, 'top-9 w-8')} />
      <div className={cn(s.bar, 'top-12 h-1 w-12 opacity-20')} />

      <div className={cn(s.bar, 'top-14 mt-1 w-7 h-6 opacity-15 rounded')} />
      <div className={cn(s.bar, 'top-14 left-10 mt-1 w-7 h-6 opacity-10 rounded')} />

      <div className={cn(s.bar, 'bottom-9 h-1 w-14 opacity-20')} />

      <div className={cn(s.bar, 'bottom-5')} />
      <div className={cn(s.bar, 'bottom-2 h-1 w-14 opacity-20')} />
    </div>
  )
}

export default Sidebar
