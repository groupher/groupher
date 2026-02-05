import { sortByColor } from '~/helper'
import type { TColorName } from '~/spec'

import TagNode from '~/widgets/TagNode'
import type { TProps as TBase } from '.'
import useSalon from './salon'
import { getDotMargin, getDotSize, getHashMargin, getIconSize } from './salon/metric'

type TProps = TBase & { withTitle?: boolean }

export default ({ items, max, size, withTitle = true, ...spacing }: TProps) => {
  const s = useSalon(spacing)

  const dotSize = getDotSize(size)
  const hashSize = getIconSize(size)
  const dotRight = getDotMargin(size)
  const hashRight = getHashMargin(size)

  return (
    <>
      {sortByColor([...items])
        .slice(0, max)
        .map((tag) => (
          <div className={s.tag} key={tag.slug}>
            <TagNode
              color={tag.color as TColorName}
              dotSize={dotSize}
              hashSize={hashSize}
              dotRight={dotRight}
              hashRight={hashRight}
            />
            {withTitle && <div className={s.title}>{tag.title}</div>}
          </div>
        ))}
    </>
  )
}
