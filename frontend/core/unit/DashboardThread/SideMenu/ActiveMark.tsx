import { m } from 'motion/react'

import { ACTIVE_LAYOUT_ID, ACTIVE_TRANSITION } from './animation'

type TProps = {
  barClassName: string
  bgClassName: string
  scope: 'doc' | 'main'
}

export default function ActiveMark({ barClassName, bgClassName, scope }: TProps) {
  const bgLayoutId = scope === 'doc' ? ACTIVE_LAYOUT_ID.DOC_BG : ACTIVE_LAYOUT_ID.MAIN_BG
  const barLayoutId = scope === 'doc' ? ACTIVE_LAYOUT_ID.DOC_BAR : ACTIVE_LAYOUT_ID.MAIN_BAR

  return (
    <>
      <m.div layoutId={bgLayoutId} className={bgClassName} transition={ACTIVE_TRANSITION} />
      <m.div layoutId={barLayoutId} className={barClassName} transition={ACTIVE_TRANSITION} />
    </>
  )
}
