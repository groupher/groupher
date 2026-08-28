import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import MoreSVG from '~/icons/menu/MoreL'

import { DOC_ACTION_LABEL_KEY } from './constant'
import useSalon from './salon/more'

const More: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const label = t(DOC_ACTION_LABEL_KEY.MORE)

  return (
    <button type='button' className={s.button} aria-label={label} title={label}>
      <MoreSVG className={s.icon} />
    </button>
  )
}

export default More
