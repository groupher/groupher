import type { FC } from 'react'
import { EMPTY_TAG } from '~/const/utils'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/Arrow'
import type { TTag } from '~/spec'

import useSalon from './salon/goback_tag'

type TProps = {
  onSelect?: (tag?: TTag) => void
}

const GoBackTag: FC<TProps> = ({ onSelect }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <button type='button' className={s.wrapper} onClick={() => onSelect(EMPTY_TAG)}>
      <ArrowSVG className={s.arrow} />
      <div className={s.title}>{t('tags.all')}</div>
    </button>
  )
}

export default GoBackTag
