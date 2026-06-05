/* *
 * CoverEditor
 *
 */

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FC } from 'react'

import Cover from './Cover'
import useSalon from './salon'
import TuningPanel from './TuningPanel'

type TProps = {
  onDelete?: () => void
  onReplace?: () => void
}

const CoverEditor: FC<TProps> = ({ onDelete = console.log, onReplace = console.log }) => {
  const s = useSalon()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlRef = useRef('')
  const [imageUrl, setImageUrl] = useState('')

  const openFilePicker = (): void => fileInputRef.current?.click()

  const revokeObjectUrl = (): void => {
    if (!objectUrlRef.current) return

    URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = ''
  }

  const setLocalImageFile = (file: File | undefined): void => {
    if (!file) return

    revokeObjectUrl()

    // Local object URLs keep the selected image in the browser only; server upload can happen later.
    const nextImageUrl = URL.createObjectURL(file)
    objectUrlRef.current = nextImageUrl
    setImageUrl(nextImageUrl)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setLocalImageFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDelete = (): void => {
    revokeObjectUrl()
    setImageUrl('')
    onDelete()
  }

  useEffect(() => revokeObjectUrl, [])

  return (
    <div className={s.wrapper} style={s.wrapperStyle}>
      <input
        ref={fileInputRef}
        className='hidden'
        type='file'
        accept='image/*'
        onChange={handleFileChange}
      />
      <Cover imageUrl={imageUrl} onDropFile={setLocalImageFile} onUpload={openFilePicker} />
      {imageUrl && (
        <TuningPanel
          defaultExpanded
          onDelete={handleDelete}
          onReplace={() => {
            onReplace()
            openFilePicker()
          }}
        />
      )}
    </div>
  )
}

export default CoverEditor
