/*
 *
 * ArticleBroadcast
 *
 */

import type { FC } from 'react'
import { COLOR } from '~/const'
import BroadcastSVG from '~/icons/Broadcast'
import type { TColorName, TSpace } from '~/spec'
import ArrowButton from '~/widgets/Buttons/ArrowButton'

import useSalon, { cn } from './salon'

type TProps = {
  testid?: string
  color?: TColorName
  simple?: boolean
} & TSpace

const ArticleBroadcast: FC<TProps> = ({
  testid = 'article-broadcast',
  color = COLOR.PURPLE,
  simple = false,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={cn(s.wrapper, s.rainbow(color, 'bgSoft'))}>
      {!simple && <div className={s.bgWrapper} style={s.bgStyle} />}
      {!simple && <div className={s.bgWrapper2} style={s.bgStyle2} />}
      {!simple && (
        <BroadcastSVG
          className={cn(s.notifyIcon, s.rainbow(color, 'fill'))}
          style={s.notifyStyle}
        />
      )}

      <div className={s.content}>
        <div className={s.title}>文章页脚广播</div>
        <div className={s.desc}>
          由社区管理员设置，在每篇帖子下面显示，后期可提供更详细的显示设置,
        </div>
      </div>
      <div className='grow' />

      <div className={s.linkBtn}>
        <ArrowButton>详情</ArrowButton>
      </div>
    </div>
  )
}

export default ArticleBroadcast
