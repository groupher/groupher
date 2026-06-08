import { useState } from 'react'
import type { DragEvent } from 'react'

import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'
import ImgUploadSVG from '~/icons/ImgUpload'

import useSalon from './salon/placeholder'

type TProps = {
  onDropFile: (file: File) => void
  onUpload: () => void
}

export default function Placeholder({ onDropFile, onUpload }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const [dragging, setDragging] = useState(false)

  const handleDragOver = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault()
  }

  const handleDragEnter = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    setDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    setDragging(false)

    const file = event.dataTransfer.files?.[0]
    if (!file?.type.startsWith('image/')) return

    onDropFile(file)
  }

  return (
    <button
      type='button'
      className={cn(s.wrapper, dragging && s.wrapperActive)}
      aria-label={t('cover_editor.placeholder.action')}
      onClick={onUpload}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <span className={s.dashedFrame} />
      <div className={s.inner}>
        <ImgUploadSVG className={s.uploadIcon} />
        <div className={s.title}>{t('cover_editor.placeholder.action')}</div>
        <div className={s.desc}>
          <span>{t('cover_editor.placeholder.theme_desc')}</span>
        </div>
      </div>
    </button>
  )
}
