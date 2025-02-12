import { useState } from 'react'

import { BROADCAST_LAYOUT } from '~/const/layout'

import ArrowSVG from '~/icons/ArrowSimple'
import Button from '~/widgets/Buttons/Button'

import Center from './Center'
import Default from './Default'

import useBroadcast from '../../../logic/useBroadcast'
import useSalon, { cn } from '../../../salon/broadcast/templates/global'

export default () => {
  const s = useSalon()

  const [showAll, setShowAll] = useState<boolean>(false)
  const { broadcastLayout } = useBroadcast()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.divider, 'mt-2 mb-10')} />

      {showAll ? (
        <>
          <Center onSelect={() => setShowAll(false)} />
          <Default onSelect={() => setShowAll(false)} />
        </>
      ) : (
        <>
          {broadcastLayout === BROADCAST_LAYOUT.CENTER && <Center />}
          {broadcastLayout === BROADCAST_LAYOUT.DEFAULT && <Default />}
        </>
      )}
      <Button size="small" ghost noBorder onClick={() => setShowAll(!showAll)}>
        {showAll ? '收起' : '更换模板'}
        <ArrowSVG className={cn(s.arrow, showAll ? 'rotate-90' : 'rotate-180')} />
      </Button>

      <div className={cn(s.divider, 'mt-8')} />
    </div>
  )
}
