import { useEffect } from 'react'

import { useAutoAnimate } from '@formkit/auto-animate/react'
import { sortByIndex } from '~/helper'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import TagBar from './TagBar'
import useTags from '../logic/useTags'

export default () => {
  const { loading, loadTags, getTags } = useTags()
  const [animateRef] = useAutoAnimate()

  const tags = getTags()

  useEffect(() => {
    loadTags()
  }, [])

  return (
    <div ref={animateRef}>
      {loading && <LavaLampLoading bottom={10} />}

      {sortByIndex(tags).map((tag, index) => (
        <TagBar
          key={tag.id}
          tag={tag}
          isFirst={index === 0}
          isLast={index === tags.length - 1}
          total={tags.length}
        />
      ))}
    </div>
  )
}
