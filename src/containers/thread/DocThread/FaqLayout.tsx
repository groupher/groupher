import { type FC, memo } from 'react'

import type { TSpace } from '~/spec'
import { DOC_FAQ_LAYOUT } from '~/const/layout'

import FaqList from '~/widgets/FaqList'

import useSalon from './styles/faq_layout'

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
