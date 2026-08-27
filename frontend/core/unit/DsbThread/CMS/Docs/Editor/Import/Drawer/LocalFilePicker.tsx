import { useRef, useState, type ChangeEvent, type DragEvent, type FC } from 'react'

import useTrans from '~/hooks/useTrans'
import DownloadSimpleSVG from '~/icons/DownloadSimple'
import { DOCUMENT_IMPORT_ACCEPT } from '~/lib/documentImport'

import useSalon, { cn } from './salon/local_file_picker'

type TProps = {
  pending: boolean
  onSelect: (file: File) => void
}

const LocalFilePicker: FC<TProps> = ({ pending, onSelect }) => {
  const s = useSalon()
  const { t } = useTrans()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

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
    <div className={s.filePickerFrame}>
      <input
        ref={inputRef}
        className='hidden'
        type='file'
        accept={DOCUMENT_IMPORT_ACCEPT}
        onChange={handleFileChange}
      />
      <button
        type='button'
        className={cn(s.filePicker, dragging && s.filePickerActive)}
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
        <DownloadSimpleSVG className={cn(s.filePickerIcon, pending && 'animate-pulse')} />
        <span className={s.filePickerAction}>
          {pending ? t('dsb.doc.import.converting') : t('dsb.doc.import.upload')}
        </span>
        <span className={s.filePickerHint}>{t('dsb.doc.import.formats')}</span>
      </button>
    </div>
  )
}

export default LocalFilePicker
