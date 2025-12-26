import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useEffect } from 'react'
import { sortByIndex } from '~/helper'

import type { TTag } from '~/spec'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import useTags from '../logic/useTags'
import TagBar from './TagBar'

export default () => {
  const { loading, loadTags, getTags } = useTags()
  const [animateRef] = useAutoAnimate()

  const tags = getTags()

  useEffect(() => {
    loadTags()
  }, [loadTags])

  return (
    <div ref={animateRef}>
      {loading && <LavaLampLoading bottom={10} />}

      {/* @ts-ignore */}
      {sortByIndex(tags).map((tag, index) => (
        <TagBar
          key={tag.index}
          tag={tag as TTag}
          isFirst={index === 0}
          isLast={index === tags.length - 1}
          total={tags.length}
        />
      ))}
    </div>
  )
}
