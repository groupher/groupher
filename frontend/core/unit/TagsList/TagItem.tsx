import type { TColorName, TSizeTSM, TTag } from '~/spec'
import TagNode from '~/widgets/TagNode'

import { getDotMargin, getDotSize, getHashMargin, getIconSize } from './salon/metric'
import useSalon from './salon/tag_item'

type TProps = { tag: TTag } & { withTitle?: boolean; size?: TSizeTSM }

export default function TagItem({ tag, size, withTitle }: TProps) {
  const s = useSalon({ color: tag.color as TColorName })

  const dotSize = getDotSize(size)
  const hashSize = getIconSize(size)
  const dotRight = getDotMargin(size)
  const hashRight = getHashMargin(size)

  return (
    <div className={s.wrapper}>
      <TagNode
        color={tag.color as TColorName}
        dotSize={dotSize}
        hashSize={hashSize}
        dotRight={dotRight}
        hashRight={hashRight}
      />

      {withTitle && <div className={s.title}>{tag.title}</div>}
    </div>
  )
}
