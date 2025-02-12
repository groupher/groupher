import type { FC } from 'react'

import type { TColorName, TTag } from '~/spec'
import { cutRest } from '~/fmt'
import { Trans } from '~/i18n'
import { EMPTY_TAG } from '~/const/utils'
import TagNode from '~/widgets/TagNode'
import CloseSVG from '~/icons/CloseLight'
import CheckVG from '~/icons/CheckBold'

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
      <div className={s.tag} onClick={() => onSelect(tag)}>
        <TagNode color={tag.color as TColorName} boldHash />
        <div className={s.title}>{cutRest(Trans(tag.title), 10)}</div>
      </div>
      {active && (
        <div className={s.closeBox} onClick={(e) => onSelect(EMPTY_TAG)}>
          <CloseSVG className={s.closeIcon} />
          <CheckVG className={s.checkIcon} />
        </div>
      )}
    </div>
  )
}

export default TagItem
