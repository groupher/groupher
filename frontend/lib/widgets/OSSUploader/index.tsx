/* eslint-disable jsx-a11y/label-has-for */
/*
 * OSSUploader
 */
import { type FC, type ReactNode, useState, useEffect, useRef, useCallback } from 'react'
import Script from 'next/script'

import uid from '~/utils/uid'
import { assetPath } from '~/helper'

import CrossSVG from '~/icons/CloseCross'
import UploadSVG from '~/icons/Upload'
import TurboSVG from '~/icons/Turbo'

import PreviewBlock from './PreviewBlock'

import useSalon, { cn } from './salon'
import { initOSSClient, handleUploadFile, applyUploadTokensIfNeed } from './helper'

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

  const [loaded, setOnLoad] = useState(false)
  const [uniqueId, setUniqueId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [ossClient, setOSSClient] = useState(null)

  const labelRef = useRef(null)

  useEffect(() => {
    if (loaded) {
      // see https://stackoverflow.com/a/53572588
      // eslint-disable-next-line no-inner-declarations
      async function initOSS() {
        await applyUploadTokensIfNeed()
        const ossClient = initOSSClient()

        setOSSClient(ossClient)
        setUniqueId(uid.gen())
      }

      initOSS()
    }
  }, [loaded])

  const onStart = useCallback(() => {
    setLoading(true)
  }, [])

  const onDone = useCallback(
    (url) => {
      setLoading(false)
      // console.log('## ## url: ', url)
      // console.log('## ## asset url: ', assetPath(url))
      onUploadDone(assetPath(url))
    },
    [onUploadDone],
  )

  const onError = useCallback((msg) => {
    setLoading(false)
  }, [])

  const callbacks = { onStart, onDone, onError }
  const showPreview = !!previewUrl

  return (
    <div className={s.wrapper}>
      <Script
        src="https://gosspublic.alicdn.com/aliyun-oss-sdk-6.18.1.min.js"
        onLoad={() => setOnLoad(true)}
      />

      {showPreview && (
        <div className={s.crossIcon} onClick={onDelete}>
          <CrossSVG className={s.crossIcon} />
        </div>
      )}

      <div className={s.inner}>
        <input
          className={s.inputFile}
          id={`file-${uniqueId}`}
          type="file"
          name={`file-${uniqueId}`}
          accept={fileType}
          onChange={(e) => handleUploadFile(ossClient, e, filePrefix, callbacks)}
        />
        <label
          ref={labelRef}
          className={cn(s.label, loading && 'brightness-75')}
          htmlFor={`file-${uniqueId}`}
        >
          {showPreview ? <PreviewBlock url={previewUrl} /> : <>{children}</>}
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
