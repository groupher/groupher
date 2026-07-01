import { m } from 'motion/react'
import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import PaperPlaneTiltSVG from '~/icons/PaperPlaneTilt'

import { DOC_EDITOR_LABEL_KEY } from '../../constant'
import { TITLE_STAGE_VIEW, type TTitleStageView } from './constant'
import useSalon from './salon/stage'

type TProps = {
  view: TTitleStageView
}

const STAGE_TRANSITION = {
  type: 'spring',
  duration: 0.32,
  bounce: 0,
} as const

const Stage: FC<TProps> = ({ view }) => {
  const s = useSalon({ view })
  const { t } = useTrans()
  const label =
    view === TITLE_STAGE_VIEW.PUBLISHED
      ? t(DOC_EDITOR_LABEL_KEY.STAGE_PUBLISHED)
      : t(DOC_EDITOR_LABEL_KEY.STAGE_DRAFT)

  return (
    <m.div
      className={s.scene}
      initial={{ opacity: 0, rotateX: -88, y: -8 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      exit={{ opacity: 0, rotateX: 88, y: 8 }}
      transition={STAGE_TRANSITION}
      style={{ perspective: 420, transformOrigin: '50% 50% -12px', transformStyle: 'preserve-3d' }}
    >
      <div className={s.wrapper}>
        {view === TITLE_STAGE_VIEW.PUBLISHED ? (
          <PaperPlaneTiltSVG className={s.icon} />
        ) : (
          <span className={s.dot} aria-hidden='true' />
        )}
        <span>{label}</span>
      </div>
    </m.div>
  )
}

export default Stage
