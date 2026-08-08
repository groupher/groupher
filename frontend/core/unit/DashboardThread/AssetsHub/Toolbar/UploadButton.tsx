'use client'

import { useRef } from 'react'

import Button from '~/ui/Buttons/Button'
import IconHub from '~/ui/IconHub'

import { ASSETS_HUB_ACCEPT_MIME, ASSETS_HUB_LABEL } from '../constant'
import useSalon from './salon/upload_button'

type TProps = {
  busy: boolean
  onUpload: (file: File) => Promise<void>
}

export default function UploadButton({ busy, onUpload }: TProps) {
  const s = useSalon()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <Button loading={busy} disabled={busy} size='small' onClick={() => inputRef.current?.click()}>
        <span className={s.buttonContent}>
          <IconHub provider='lucide' icon='upload' size={3.25} />
          {ASSETS_HUB_LABEL.UPLOAD}
        </span>
      </Button>

      <input
        ref={inputRef}
        className={s.fileInput}
        type='file'
        accept={ASSETS_HUB_ACCEPT_MIME}
        aria-label={ASSETS_HUB_LABEL.FILE_INPUT}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void onUpload(file)
          event.target.value = ''
        }}
      />
    </>
  )
}
