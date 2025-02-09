import type { FC } from 'react'

import { BROADCAST_LAYOUT } from '~/const/layout'

import CrossSVG from '~/icons/CloseCross'
import NotifySVG from '~/icons/Trumpet'

import useBroadcast from '../../../logic/useBroadcast'
import useSalon, { cn } from '../../../salon/broadcast/templates/global/default'

type TProps = {
  onSelect?: () => void
}

const Default: FC<TProps> = ({ onSelect = null }) => {
  const s = useSalon()

  const { broadcastLayout, edit } = useBroadcast()
  const active = broadcastLayout === BROADCAST_LAYOUT.DEFAULT

  return (
    <div
      className={cn(s.wrapper, active && s.active)}
      onClick={() => {
        edit(BROADCAST_LAYOUT.DEFAULT, 'broadcastLayout')
        onSelect?.()
      }}
    >
      <div className={s.notifyBar}>
        <NotifySVG className={s.icon} />
        <div className={cn(s.bar, 'w-32 ml-2')} />
        <div className="grow" />
        <div className={cn(s.bar, 'w-14 mr-1')} />
        <CrossSVG className={s.icon} />
      </div>
    </div>
  )
}

export default Default
