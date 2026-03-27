import { sortByColor } from '~/helper'

import type { TProps as TBase } from '.'
import TagItem from './TagItem'

type TProps = TBase & { withTitle?: boolean }

export default function List({ items, max, size, withTitle = true }: TProps) {
  return (
    <>
      {sortByColor([...items])
        .slice(0, max)
        .map((tag) => (
          <TagItem key={tag.slug} tag={tag} withTitle={withTitle} size={size} />
        ))}
    </>
  )
}
