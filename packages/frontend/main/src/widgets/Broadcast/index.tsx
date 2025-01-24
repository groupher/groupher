'use client'

import { type FC, Fragment } from 'react'

import { ANCHOR } from '~/const/dom'
import { BROADCAST_LAYOUT } from '~/const/layout'
import useBroadcast from '~/hooks/useBroadcast'

import CrossSVG from '~/icons/CloseCross'
import ArrowSVG from '~/icons/Arrow'
import NotifySVG from '~/icons/Trumpet'

import useSalon, { cn } from './salon'

type TProps = {
  testid?: string
}

const DETAIL_TEXT =
  'Groupher.com, 为中小产品团队提供社区反馈服务，如果你对此有兴趣，欢迎加 v(mydearxym) 详聊。'

const Broadcast: FC<TProps> = ({ testid = 'banner-notify' }) => {
  const s = useSalon()

  const { broadcastBg: bg, broadcastLayout: layout, broadcastEnable: enabled } = useBroadcast()

  if (!enabled) return null

  return (
    <div id={ANCHOR.GLOBAL_HEADER_ID} className={cn(s.wrapper, s.rainbow(bg, 'bg'))}>
      <div className={cn(s.inner, layout === BROADCAST_LAYOUT.CENTER && 'justify-center')}>
        <div className="row">
          <NotifySVG className={s.icon} />
          <div className={s.desc}>站点开发重构中，服务暂不可用。</div>
        </div>

        <div className="row">
          {layout === BROADCAST_LAYOUT.DEFAULT ? (
            <Fragment>
              <div
                className={cn(s.linkBtn, s.rainbow(bg, 'bg'))}
                onClick={() => alert(DETAIL_TEXT)}
              >
                查看详情
              </div>
              <CrossSVG className={s.icon} />
            </Fragment>
          ) : (
            <Fragment>
              <div className={s.linkText} onClick={() => alert(DETAIL_TEXT)}>
                查看详情
              </div>
              <ArrowSVG className={s.icon} />
            </Fragment>
          )}
        </div>
      </div>
    </div>
  )
}

export default Broadcast
