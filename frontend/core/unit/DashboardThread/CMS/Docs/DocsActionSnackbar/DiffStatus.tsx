import type { FC } from 'react'

import MergeSVG from '~/icons/Merge'

import { DIFF_STATUS, DOC_ACTION } from './constant'
import useSalon from './salon/diff_status'

const DiffStatus: FC = () => {
  const s = useSalon()

  return (
    <button type='button' className={s.button} aria-label={DOC_ACTION.DIFF} title={DOC_ACTION.DIFF}>
      <MergeSVG className={s.icon} />
      <span className={s.add}>{DIFF_STATUS.ADD}</span>
      <span className={s.remove}>{DIFF_STATUS.REMOVE}</span>
    </button>
  )
}

export default DiffStatus
