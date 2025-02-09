import type { FC } from 'react'

import { BROADCAST_LAYOUT } from '~/const/layout'

import CrossSVG from '~/icons/CloseCross'
import NotifySVG from '~/icons/Trumpet'

import useBroadcast from '../../../logic/useBroadcast'

import useSalon, { cn } from '../../../salon/broadcast/templates/global/default'

type TProps = {
  onSelect?: () => void
}

const Center: FC<TProps> = ({ onSelect = null }) => {
  const s = useSalon()

  const { broadcastLayout, edit } = useBroadcast()
  const active = broadcastLayout === BROADCAST_LAYOUT.CENTER

  return (
    <div
      className={cn(s.wrapper, active && s.active)}
      onClick={() => {
        edit(BROADCAST_LAYOUT.CENTER, 'broadcastLayout')
        onSelect?.()
      }}
    >
      <div className={s.notifyBar}>
        <div className="grow" />
        <NotifySVG className={s.icon} />
        <div className={cn(s.bar, 'w-32 ml-2')} />
        <div className={cn(s.bar, 'w-10 ml-3')} />
        <div className="grow" />
        <CrossSVG className={s.icon} />
      </div>
    </div>
  )
}

export default Center
