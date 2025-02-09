import type { FC } from 'react'

import { BROADCAST_ARTICLE_LAYOUT } from '~/const/layout'
import ArticleBroadcast from '~/widgets/ArticleBroadcast'

import useBroadcast from '../../../logic/useBroadcast'
import useSalon, { cn } from '../../../salon/broadcast/templates/article/default'

type TProps = {
  onSelect?: () => void
}

const Default: FC<TProps> = ({ onSelect = null }) => {
  const s = useSalon()

  const { broadcastArticleLayout, broadcastArticleBg, edit } = useBroadcast()
  const active = broadcastArticleLayout === BROADCAST_ARTICLE_LAYOUT.DEFAULT

  return (
    <div
      className={cn(s.wrapper, active && s.active)}
      onClick={() => {
        edit(BROADCAST_ARTICLE_LAYOUT.DEFAULT, 'broadcastArticleLayout')
        onSelect?.()
      }}
    >
      <div className={cn(s.bar, 'h-2.5 w-32')} />
      <div className={cn(s.bar, 'h-2 w-8/12 opacity-30 mt-5')} />
      <div className={cn(s.bar, 'h-2 w-10/12 opacity-20 mt-4')} />
      <div className={cn(s.bar, 'h-2 w-7/12 opacity-15 mt-4')} />
      <div className={cn(s.bar, 'h-2 w-7/12 opacity-10 mt-4')} />

      <div className="mt-7" />
      <ArticleBroadcast color={broadcastArticleBg} />
    </div>
  )
}

export default Default
