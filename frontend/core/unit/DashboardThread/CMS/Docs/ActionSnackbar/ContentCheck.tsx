import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import ShieldCheckSVG from '~/icons/ShieldCheck'

import { DOC_ACTION_LABEL_KEY } from './constant'
import useSalon from './salon/content_check'

const ContentCheck: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const label = t(DOC_ACTION_LABEL_KEY.CHECK)

  return (
    <button type='button' className={s.button} aria-label={label} title={label}>
      <ShieldCheckSVG className={s.icon} />
    </button>
  )
}

export default ContentCheck
