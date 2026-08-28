'use client'

import { ASSETS_HUB_LABEL, ASSETS_HUB_UPLOAD_STATUS } from './constant'
import { formatAssetSize, formatUploadDuration } from './helper'
import useSalon from './salon/upload_status'
import type { TTiming, TUploadProgress } from './spec'

type TProps = {
  status: string
  timings: TTiming[]
  uploadProgress: TUploadProgress | null
}

export default function UploadStatus({ status, timings, uploadProgress }: TProps) {
  const s = useSalon()
  const visible =
    status !== ASSETS_HUB_UPLOAD_STATUS.IDLE || uploadProgress !== null || timings.length > 0

  if (!visible) return null

  return (
    <div className={s.wrapper}>
      <div className={s.state}>
        {ASSETS_HUB_LABEL.UPLOAD_STATUS}: {status}
      </div>

      {uploadProgress && (
        <div className={s.progress}>
          <div className={s.progressBar} style={{ width: `${uploadProgress.percent}%` }} />
          <div className={s.progressMeta}>
            <span>{uploadProgress.percent}%</span>
            <span>
              {formatAssetSize(uploadProgress.loaded)} / {formatAssetSize(uploadProgress.total)}
            </span>
          </div>
        </div>
      )}

      {timings.length > 0 && (
        <div className={s.timings}>
          {timings.map((item) => (
            <div className={s.timingItem} key={item.label}>
              <span>{item.label}</span>
              <span className={s.timingValue}>{formatUploadDuration(item.duration)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
