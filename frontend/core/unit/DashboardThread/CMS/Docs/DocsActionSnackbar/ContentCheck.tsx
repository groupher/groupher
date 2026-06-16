import type { FC } from 'react'

import ShieldCheckSVG from '~/icons/ShieldCheck'

import { DOC_ACTION } from './constant'
import useSalon from './salon/content_check'

const ContentCheck: FC = () => {
  const s = useSalon()

  return (
    <button
      type='button'
      className={s.button}
      aria-label={DOC_ACTION.CHECK}
      title={DOC_ACTION.CHECK}
    >
      <ShieldCheckSVG className={s.icon} />
    </button>
  )
}

export default ContentCheck
