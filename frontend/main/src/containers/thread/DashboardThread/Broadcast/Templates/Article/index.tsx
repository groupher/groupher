import { useState } from 'react'

import { BROADCAST_ARTICLE_LAYOUT } from '~/const/layout'

import ArrowSVG from '~/icons/ArrowSimple'
import Button from '~/widgets/Buttons/Button'

import Simple from './Simple'
import Default from './Default'

import useBroadcast from '../../../logic/useBroadcast'
import useSalon, { cn } from '../../../salon/broadcast/templates/article'

export default () => {
  const s = useSalon()

  const [showAll, setShowAll] = useState<boolean>(false)
  const { broadcastArticleLayout } = useBroadcast()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.divider, 'mt-2 mb-10')} />
      {showAll ? (
        <>
          <Default onSelect={() => setShowAll(false)} />
          <Simple onSelect={() => setShowAll(false)} />
        </>
      ) : (
        <>
          {broadcastArticleLayout === BROADCAST_ARTICLE_LAYOUT.DEFAULT && <Default />}
          {broadcastArticleLayout === BROADCAST_ARTICLE_LAYOUT.SIMPLE && <Simple />}
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
