import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useEffect } from 'react'
import { sortByIndex } from '~/helper'

import type { TTag } from '~/spec'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import useTags from '../logic/useTags'
import TagBar from './TagBar'

export default () => {
  const { loading, loadTags, tags } = useTags()
  const [animateRef] = useAutoAnimate()

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    loadTags()
  }, [])

  return (
    <div ref={animateRef}>
      {loading && <LavaLampLoading bottom={10} />}

      {sortByIndex(tags).map((tag, index) => (
        <TagBar
          key={tag.id}
          tag={tag as TTag}
          isFirst={index === 0}
          isLast={index === tags.length - 1}
          total={tags.length}
        />
      ))}
    </div>
  )
}
