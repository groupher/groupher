import type { FC } from 'react'
import { isEmpty } from 'ramda'

import type { TColorName } from '~/spec'
import useViewingArticle from '~/hooks/useViewingArticle'

import ArrowSVG from '~/icons/ArrowSimple'
import TagNode from '~/widgets/TagNode'

import useSalon, { cn } from '../salon/menu/tags_item'

type TProps = {
  onClick: () => void
}

const TagsItem: FC<TProps> = ({ onClick }) => {
  const s = useSalon()

  const { article } = useViewingArticle()
  const tags = article.articleTags

  if (!isEmpty(tags)) {
    const tag = tags[0]

    return (
      <div className={s.menuItem} onClick={onClick}>
        <TagNode
          dotRight={1.5}
          dotLeft={2}
          dotTop={1}
          hashLeft="px"
          hashRight={1.5}
          hashSize={3.5}
          color={tag.color as TColorName}
        />
        <div className={s.tagTitle}>{tag.title}</div>
        {tags.length > 1 && <div className={s.tagCount}>({tags.length})</div>}
        <div className="grow" />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </div>
    )
  }

  return (
    <div className={s.menuItem} onClick={onClick}>
      <TagNode dotRight={1.5} dotLeft={2} dotTop={1} hashLeft="px" hashRight={1.5} hashSize={3.5} />
      标签
      <div className="grow" />
      <ArrowSVG className={cn(s.icon, 'rotate-180')} />
    </div>
  )
}

export default TagsItem
