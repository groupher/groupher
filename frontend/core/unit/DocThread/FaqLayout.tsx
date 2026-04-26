import { type FC, memo } from 'react'

import { DOC_FAQ_LAYOUT } from '~/const/layout'
import type { TSpace } from '~/spec'
import FaqList from '~/unit/FaqList'

import useSalon from './salon/faq_layout'

type TProps = TSpace

const FaqLayout: FC<TProps> = ({ ...spacing }) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper}>
      <FaqList layout={DOC_FAQ_LAYOUT.COLLAPSE} />
    </div>
  )
}

export default memo(FaqLayout)
