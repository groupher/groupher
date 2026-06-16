import type { FC } from 'react'

import InfoSVG from '~/icons/Info'

import { DOC_ACTION } from './constant'
import useSalon from './salon/doc_info'

const DocInfo: FC = () => {
  const s = useSalon()

  return (
    <button type='button' className={s.button} aria-label={DOC_ACTION.INFO} title={DOC_ACTION.INFO}>
      <InfoSVG className={s.icon} />
    </button>
  )
}

export default DocInfo
