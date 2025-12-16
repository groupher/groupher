/* eslint-disable jsx-a11y/accessible-emoji */
/*
 *
 * TagNote
 *
 */

import useActiveTag from '~/hooks/useActiveTag'
import type { TColorName } from '~/spec'
import Markdown from '~/widgets/Markdown'
import TagNode from '~/widgets/TagNode'

import useSalon from './salon'

export default () => {
  const tag = useActiveTag()
  const s = useSalon()

  if (!tag?.title) return null

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.tagWrapper}>
          <TagNode
            color={tag.color as TColorName}
            dotSize={8}
            hashSize={3}
            dotLeft={5}
            hashLeft={0.5}
            hashRight={1}
            boldHash
          />
          <div className={s.title}>{tag.title}</div>
        </div>
      </div>
      <Markdown className='-ml-3.5 scale-95'>{tag.desc || ''}</Markdown>
    </div>
  )
}
