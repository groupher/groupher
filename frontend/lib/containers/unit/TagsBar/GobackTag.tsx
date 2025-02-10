import type { FC } from 'react'

import type { TTag } from '~/spec'
import { EMPTY_TAG } from '~/const/utils'
import ArrowSVG from '~/icons/Arrow'

import useSalon from './salon/goback_tag'

type TProps = {
  onSelect?: (tag?: TTag) => void
}

const GobackTag: FC<TProps> = ({ onSelect }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper} onClick={() => onSelect(EMPTY_TAG)}>
      <ArrowSVG className={s.arrow} />
      <div className={s.title}>全部标签</div>
    </div>
  )
}

export default GobackTag
