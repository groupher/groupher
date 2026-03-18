import { INLINE_TAG_LAYOUT } from '~/const/layout'
import type { TColorName, TInlineTagLayout, TTag } from '~/spec'
import TagNode from '~/widgets/TagNode'
import useSalon from '../../salon/layout/inline_tag_layout/tag_item'

type TProps = {
  tag: TTag
  layout: TInlineTagLayout
}

export default function TagItem({ tag, layout }: TProps) {
  const s = useSalon({ color: tag.color as TColorName, layout })

  const noTagNode = (
    [INLINE_TAG_LAYOUT.SOLID, INLINE_TAG_LAYOUT.SOFT] as readonly TInlineTagLayout[]
  ).includes(layout)

  return (
    <div className={s.wrapper}>
      {!noTagNode && (
        <TagNode
          color={tag.color as TColorName}
          dotSize={1.5}
          hashSize={2.5}
          dotRight={1}
          hashRight={0.5}
        />
      )}

      <div className={s.title}>{tag.title}</div>
    </div>
  )
}
