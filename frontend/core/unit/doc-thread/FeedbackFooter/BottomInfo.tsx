/*
 *
 * FeedbackFooter
 *
 */

import { type FC, useState } from 'react'

import type { TSpace } from '~/spec'
import { HELP_FEEDBACK } from './constant'
import BadSVG from './salon/BadSVG'
import useSalon, { cn } from './salon/bottom_info'
import GoodSVG from './salon/GoodSVG'
import SoSoSVG from './salon/SoSoSVG'
import type { TDocFeedback } from './spec'

type TProps = {
  offsetRight: number
  withLastUpdated?: boolean
} & TSpace

const FeedbackFooter: FC<TProps> = ({ offsetRight, withLastUpdated = true }) => {
  const s = useSalon({ offsetRight, withLastUpdated })

  const { GOOD, BAD, SOSO } = HELP_FEEDBACK
  const [feedback, setFeedback] = useState<TDocFeedback | ''>('')

  return (
    <div className={s.wrapper}>
      {withLastUpdated && <div className={s.lastUpdate}>最后更新: 3 天前</div>}
      <div className={s.feedback}>
        <div className={cn(s.title, withLastUpdated && s.titleSmall)}>本文是否有帮助?</div>
        <div className={cn(s.faces, withLastUpdated && s.facesSmall)}>
          <div
            className={cn(s.iconBox, feedback === BAD && s.iconBoxActive)}
            onClick={() => setFeedback(BAD)}
          >
            <BadSVG className={cn(s.icon, 'circle', withLastUpdated && s.iconSmall)} />
          </div>
          <div
            className={cn(s.iconBox, feedback === SOSO && s.iconBoxActive)}
            onClick={() => setFeedback(SOSO)}
          >
            <SoSoSVG className={cn(s.icon, 'circle', withLastUpdated && s.iconSmall)} />
          </div>
          <div
            className={cn(s.iconBox, feedback === GOOD && s.iconBoxActive)}
            onClick={() => setFeedback(GOOD)}
          >
            <GoodSVG className={cn(s.icon, withLastUpdated && s.iconSmall)} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeedbackFooter
