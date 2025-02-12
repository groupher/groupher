import type { TColorName } from '~/spec'

import { sortByColor } from '~/helper'
import { Trans } from '~/i18n'

import TagNode from '~/widgets/TagNode'

import { getDotSize, getIconSize, getDotMargin, getHashMargin } from './salon/metric'
import useSalon from './salon'

import type { TProps as TBase } from '.'

type TProps = TBase & { withTitle?: boolean }

export default ({ items, max, size, withTitle = true, ...spacing }: TProps) => {
  const s = useSalon(spacing)

  const dotSize = getDotSize(size)
  const hashSize = getIconSize(size)
  const dotRight = getDotMargin(size)
  const hashRight = getHashMargin(size)

  return (
    <>
      {sortByColor(items)
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
            {withTitle && <div className={s.title}>{Trans(tag.title)}</div>}
          </div>
        ))}
    </>
  )
}
