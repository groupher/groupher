import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import { DOC_EDITOR_LABEL_KEY } from '../../constant'
import useSalon from './salon/stage'

const Stage: FC = () => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <span className={s.dot} aria-hidden='true' />
      <span>{t(DOC_EDITOR_LABEL_KEY.STAGE_DRAFT)}</span>
    </div>
  )
}

export default Stage
