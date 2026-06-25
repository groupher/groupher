import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import PaperPlaneTiltSVG from '~/icons/PaperPlaneTilt'

import { DOC_PUBLISH_STATUS, getDocPublishStatus } from '../../Editor/SideTree/helper'
import type { TDocTreeNodePublishState } from '../../Editor/SideTree/spec'
import { DOC_INFO_LABEL_KEY } from '../constant'
import useSalon from '../salon/doc_info/visibility'

type TProps = {
  state?: TDocTreeNodePublishState | null
}

const DocInfoVisibility: FC<TProps> = ({ state }) => {
  const s = useSalon()
  const { t } = useTrans()
  const published = getDocPublishStatus(state) === DOC_PUBLISH_STATUS.PUBLIC

  if (published) {
    return (
      <div className={s.published}>
        <PaperPlaneTiltSVG className={s.publishedIcon} />
        <span>{t(DOC_INFO_LABEL_KEY.VISIBILITY_PUBLISHED)}</span>
      </div>
    )
  }

  return (
    <div className={s.unpublished}>
      <span className={s.unpublishedDot} aria-hidden='true' />
      <span>{t(DOC_INFO_LABEL_KEY.VISIBILITY_UNPUBLISHED)}</span>
    </div>
  )
}

export default DocInfoVisibility
