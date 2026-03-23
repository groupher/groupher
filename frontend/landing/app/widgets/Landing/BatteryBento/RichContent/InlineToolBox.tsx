import type { FC } from 'react'

import BoldSVG from '~/icons/editor/Bold'
import HighlightSVG from '~/icons/editor/Highlight'
import LinkSVG from '~/icons/editor/Link'
import StrikeSVG from '~/icons/editor/Strike'

import useSalon, { cn } from '../../salon/battery_bento/rich_content/inline_tool_box'

type TProps = {
  hovering: boolean
}

const InlineToolBox: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, hovering && s.hover)}>
      <div className={s.item}>
        <BoldSVG className={s.icon} />
      </div>

      <div className={s.item}>
        <StrikeSVG className={s.icon} />
      </div>

      <div className={s.item}>
        <LinkSVG className={s.icon} />
      </div>

      <div className={cn(s.item, s.itemActive)}>
        <HighlightSVG className={cn(s.icon, s.iconActive)} />
      </div>
    </div>
  )
}

export default InlineToolBox
