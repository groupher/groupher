import type { FC } from 'react'
import { EMPTY_TAG } from '~/const/utils'
import { cutRest } from '~/fmt'
import CheckVG from '~/icons/CheckBold'
import CloseSVG from '~/icons/CloseLight'
import type { TColorName, TTag } from '~/spec'
import TagNode from '~/widgets/TagNode'

import useSalon from './salon/tag_item'

type TProps = {
  tag: TTag
  active: boolean
  onSelect?: (tag?: TTag) => void
}

const TagItem: FC<TProps> = ({ tag, active, onSelect }) => {
  const s = useSalon({ active, color: tag.color as TColorName })

  return (
    <div className={s.wrapper}>
      <button className={s.tag} onClick={() => onSelect(tag)}>
        <TagNode color={tag.color as TColorName} boldHash />
        <div className={s.title}>{cutRest(tag.title, 10)}</div>
      </button>
      {active && (
        <button className={s.closeBox} onClick={(_e) => onSelect(EMPTY_TAG)}>
          <CloseSVG className={s.closeIcon} />
          <CheckVG className={s.checkIcon} />
        </button>
      )}
    </div>
  )
}

export default TagItem
