'use client'

import Modal from '~/ui/Modal'

import { formatAssetSize } from '../helper'
import { STORAGE_RING_CIRCUMFERENCE, STORAGE_RING_RADIUS } from './constant'
import useSalon from './salon/detail_modal'

type TProps = {
  limit: number
  offset: number
  percent: number
  show: boolean
  used: number
  onClose: () => void
}

export default function DetailModal({ limit, offset, percent, show, used, onClose }: TProps) {
  const s = useSalon()

  return (
    <Modal show={show} width='390px' compact showCloseBtn offsetTop='28%' onClose={onClose}>
      <div className={s.body}>
        <div className={s.ring}>
          <svg className={s.svg} viewBox='0 0 52 52' aria-hidden='true'>
            <circle className={s.track} cx='26' cy='26' r={STORAGE_RING_RADIUS} strokeWidth='2' />
            <circle
              className={s.progress}
              cx='26'
              cy='26'
              r={STORAGE_RING_RADIUS}
              strokeDasharray={STORAGE_RING_CIRCUMFERENCE}
              strokeDashoffset={offset}
              strokeLinecap='round'
              strokeWidth='4'
            />
          </svg>
          <span className={s.ringPercent}>{percent}%</span>
        </div>

        <div className={s.meta}>
          <h3 className={s.title}>Storage</h3>
          <p className={s.detail}>
            {formatAssetSize(used)} / {formatAssetSize(limit)}
          </p>
          <p className={s.percent}>{percent}% used</p>
        </div>
      </div>
    </Modal>
  )
}
