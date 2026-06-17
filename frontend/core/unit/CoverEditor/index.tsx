/* *
 * CoverEditor
 *
 */

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FC } from 'react'

import { COVER_IMAGE_WHICH } from './constant'
import Cover from './Cover'
import ImageDraftProvider from './ImageDraftProvider'
import KeyboardDeleteHandler from './KeyboardDeleteHandler'
import useSalon from './salon'
import type { TCoverImageWhich } from './spec'
import TuningPanel from './TuningPanel'
import useLogic from './useLogic'

type TProps = {
  onDelete?: () => void
  onReplace?: () => void
}

const CoverEditor: FC<TProps> = ({ onDelete = console.log, onReplace = console.log }) => {
  const s = useSalon()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [keyboardDeleteEnabled, setKeyboardDeleteEnabled] = useState(false)
  const pendingImageWhichRef = useRef<TCoverImageWhich>(COVER_IMAGE_WHICH.PRIMARY)
  const objectUrlRef = useRef<Record<TCoverImageWhich, string>>({
    [COVER_IMAGE_WHICH.PRIMARY]: '',
    [COVER_IMAGE_WHICH.SECONDARY]: '',
  })
  const { imageDeleteOnChange, imageSourceOnChange, resetImages, tuningSetting } = useLogic()
  const { images } = tuningSetting
  const hasAnyImage = Boolean(images.primary || images.secondary)

  const openFilePicker = (which: TCoverImageWhich): void => {
    pendingImageWhichRef.current = which
    fileInputRef.current?.click()
  }

  const revokeObjectUrl = (which: TCoverImageWhich): void => {
    const objectUrl = objectUrlRef.current[which]
    if (!objectUrl) return

    URL.revokeObjectURL(objectUrl)
    objectUrlRef.current[which] = ''
  }

  const revokeObjectUrls = (): void => {
    revokeObjectUrl(COVER_IMAGE_WHICH.PRIMARY)
    revokeObjectUrl(COVER_IMAGE_WHICH.SECONDARY)
  }

  const setLocalImageFile = (which: TCoverImageWhich, file: File | undefined): void => {
    if (!file) return

    revokeObjectUrl(which)

    // Local object URLs keep the selected image in the browser only; server upload can happen later.
    const nextImageUrl = URL.createObjectURL(file)
    objectUrlRef.current[which] = nextImageUrl
    imageSourceOnChange(which, nextImageUrl)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setLocalImageFile(pendingImageWhichRef.current, event.target.files?.[0])
    event.target.value = ''
  }

  const handleDelete = (which: TCoverImageWhich): void => {
    const hasOtherImage =
      which === COVER_IMAGE_WHICH.PRIMARY ? Boolean(images.secondary) : Boolean(images.primary)

    revokeObjectUrl(which)
    imageDeleteOnChange(which)
    if (!hasOtherImage) onDelete()
  }

  useEffect(
    () => () => {
      revokeObjectUrls()
      resetImages()
    },
    [],
  )

  return (
    <div
      className={s.wrapper}
      style={s.wrapperStyle}
      onPointerEnter={() => setKeyboardDeleteEnabled(true)}
      onPointerLeave={() => setKeyboardDeleteEnabled(false)}
      onFocusCapture={() => setKeyboardDeleteEnabled(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardDeleteEnabled(false)
      }}
    >
      <input
        ref={fileInputRef}
        className='hidden'
        type='file'
        accept='image/*'
        onChange={handleFileChange}
      />
      <ImageDraftProvider>
        <KeyboardDeleteHandler enabled={keyboardDeleteEnabled} onDelete={handleDelete} />
        <Cover
          onDropFile={(file) => setLocalImageFile(COVER_IMAGE_WHICH.PRIMARY, file)}
          onUpload={() => openFilePicker(COVER_IMAGE_WHICH.PRIMARY)}
        />
        {hasAnyImage && (
          <TuningPanel
            defaultExpanded
            onDelete={handleDelete}
            onReplace={(which) => {
              onReplace()
              openFilePicker(which)
            }}
            onAddImage={openFilePicker}
          />
        )}
      </ImageDraftProvider>
    </div>
  )
}

export default CoverEditor
