import type { FC } from 'react'

import CodeSVG from '~/icons/editor/Code'
import ImageSVG from '~/icons/editor/Image'
import TitleSVG from '~/icons/editor/Title'
import VideoSVG from '~/icons/social/BiliBili'

import useSalon, { cn } from '../../salon/battery_bento/rich_content/tool_box'

type TProps = {
  hovering: boolean
}

const ToolBox: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, hovering && s.hover)}>
      <div className={s.item}>
        <div className={s.iconBox}>
          <TitleSVG className={s.icon} />
        </div>
        标题
      </div>
      <div className={s.item}>
        <div className={s.iconBox}>
          <ImageSVG className={s.icon} />
        </div>
        图片
      </div>
      <div className={s.item}>
        <div className={s.iconBox}>
          <CodeSVG className={s.icon} />
        </div>
        代码块
      </div>
      <div className={s.item}>
        <div className={s.iconBox}>
          <VideoSVG className={s.icon} />
        </div>
        视频
      </div>
    </div>
  )
}

export default ToolBox
