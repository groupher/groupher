import type { FC } from 'react'

import ShareSVG from '~/icons/Share'
import ReportSVG from '~/icons/WarningLight'

import useSalon from './salon/head_action'

const HeadAction: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ShareSVG className={s.icon} />
      <ReportSVG className={s.icon} />
    </div>
  )
}

export default HeadAction
