/*
 * OSSUploader
 */

import Script from 'next/script'
import { type FC, type ReactNode, useCallback, useRef, useState } from 'react'

import { assetPath } from '~/helper'
import CrossSVG from '~/icons/CloseCross'
import TurboSVG from '~/icons/Turbo'
import UploadSVG from '~/icons/Upload'
import uid from '~/utils/uid'

import { handleUploadFile, initOSSClient } from './helper'
import PreviewBlock from './PreviewBlock'
import useSalon, { cn } from './salon'

type TProps = {
  children: ReactNode
  onUploadDone?: (url: string) => void
  onDelete?: () => void
  filePrefix?: string | null
  fileType?: string
  previewUrl?: string
}

const OSSUploader: FC<TProps> = ({
  children,
  fileType = 'image/*',
  filePrefix = null,
  onUploadDone = console.log,
  onDelete = console.log,
  previewUrl = '', // 'https://static.groupher.com/ugc/_tmp/2023-10-13/Linth.png',
}) => {
  const s = useSalon()

  const [uniqueId, setUniqueId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [ossClient, setOSSClient] = useState(null)

  const labelRef = useRef(null)

  const handleScriptLoad = useCallback(() => {
    const ossClient = initOSSClient()

    setOSSClient(ossClient)
    setUniqueId(uid.gen())
  }, [])

  const onStart = () => setLoading(true)

  const onDone = (url) => {
    setLoading(false)
    // console.log('## ## url: ', url)
    // console.log('## ## asset url: ', assetPath(url))
    onUploadDone(assetPath(url))
  }

  const onError = useCallback((_msg) => {
    setLoading(false)
  }, [])

  const callbacks = { onStart, onDone, onError }
  const showPreview = !!previewUrl

  return (
    <div className={s.wrapper}>
      <Script
        src='https://gosspublic.alicdn.com/aliyun-oss-sdk-6.18.1.min.js'
        onLoad={handleScriptLoad}
      />

      {showPreview && (
        <button type='button' className={s.crossIcon} onClick={onDelete}>
          <CrossSVG className={s.crossIcon} />
        </button>
      )}

      <div className={s.inner}>
        <input
          className={s.inputFile}
          id={`file-${uniqueId}`}
          type='file'
          name={`file-${uniqueId}`}
          accept={fileType}
          onChange={(e) => handleUploadFile(ossClient, e, filePrefix, callbacks)}
        />
        <label
          ref={labelRef}
          className={cn(s.label, loading && 'brightness-75')}
          htmlFor={`file-${uniqueId}`}
        >
          {showPreview ? <PreviewBlock url={previewUrl} /> : children}
        </label>

        {!loading && (
          <UploadSVG onClick={() => labelRef.current.click()} className={s.uploadIcon} />
        )}
        {loading && <TurboSVG className={s.turboIcon} />}
      </div>
    </div>
  )
}

export default OSSUploader
