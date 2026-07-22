import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import useTrans from '~/hooks/useTrans'
import DownloadSimpleSVG from '~/icons/DownloadSimple'
import { DOCUMENT_IMPORT_ACCEPT } from '~/lib/documentImport'

import useSalon from './salon/file_picker'

type TProps = {
  pending: boolean
  onSelect: (file: File) => void
}

/** Renders the drag-and-drop local document picker used by reusable Docs import surfaces. */
export default function FilePicker({ pending, onSelect }: TProps) {
  const { t } = useTrans()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const s = useSalon({ dragging, pending })

  const selectFile = (file: File | undefined): void => {
    if (!file || pending) return
    onSelect(file)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    selectFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    setDragging(false)
    selectFile(event.dataTransfer.files?.[0])
  }

  return (
    <div className={s.frame}>
      <input
        ref={inputRef}
        className={s.input}
        type='file'
        accept={DOCUMENT_IMPORT_ACCEPT}
        onChange={handleFileChange}
      />
      <button
        type='button'
        className={s.button}
        disabled={pending}
        aria-busy={pending}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragging(false)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <DownloadSimpleSVG className={s.icon} />
        <span className={s.action}>
          {pending ? t('dsb.doc.import.converting') : t('dsb.doc.import.upload')}
        </span>
        <span className={s.hint}>{t('dsb.doc.import.formats')}</span>
      </button>
    </div>
  )
}
