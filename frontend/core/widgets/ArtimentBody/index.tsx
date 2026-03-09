/* eslint-disable react/no-danger */
/*
 * ArtimentBody
 */
import RichEditor from '@groupher/rich-editor'
import { type FC, useEffect, useMemo, useRef, useState } from 'react'

import type { TDocument } from '~/spec'

import FoldBox from './FoldBox'

import useSalon, { cn } from './salon'

const RICH_EDITOR_STORAGE_KEY = 'installation-react-demo'

type TProps = {
  testid?: string
  document: TDocument
  // 超过多行就默认折叠
  initLineClamp?: number
  mode?: 'article' | 'comment'
}

const ArtimentBody: FC<TProps> = ({
  testid = 'article-body',
  document,
  initLineClamp = 15,
  mode = 'article',
}) => {
  const s = useSalon()
  const isRichReadonly = mode === 'article' && !!document?.json

  const normalizedJson = useMemo(() => {
    if (!isRichReadonly || !document?.json) return null

    try {
      const parsed = JSON.parse(document.json)
      return Array.isArray(parsed) ? JSON.stringify(parsed) : null
    } catch {
      return null
    }
  }, [document?.json, isRichReadonly])

  const bodyRef = useRef(null)
  const [fold, setFold] = useState(false)
  const [needFold, setNeedFold] = useState(false)
  const [lineClamp, setLineClamp] = useState(initLineClamp)

  useEffect(() => {
    if (normalizedJson) {
      localStorage.setItem(RICH_EDITOR_STORAGE_KEY, normalizedJson)
    }
  }, [normalizedJson])

  useEffect(() => {
    if (isRichReadonly) {
      setNeedFold(false)
      setFold(false)
      return
    }

    if (bodyRef) {
      const { scrollHeight, clientHeight } = bodyRef.current
      // 确保只有超过两行才是折叠的情况
      if (scrollHeight - clientHeight > 22) {
        setNeedFold(true)
        setFold(true)
      } else {
        setNeedFold(false)
        setFold(false)
      }
    }
  }, [bodyRef, isRichReadonly])

  return (
    <div className={s.wrapper}>
      <div
        ref={bodyRef}
        className={cn(
          s.body,
          !isRichReadonly && `line-clamp-[${lineClamp}]`,
          mode === 'article' ? 'text-base' : 'text-sm',
        )}
      >
        {isRichReadonly ? (
          <div className={cn(s.html, 'pointer-events-none')}>
            <RichEditor />
          </div>
        ) : (
          <div
            className={s.html}
            dangerouslySetInnerHTML={{
              __html: document.html || document.bodyHtml || '',
            }}
          />
        )}
      </div>

      {needFold ? (
        <FoldBox
          fold={fold}
          mode={mode}
          onFold={() => {
            setLineClamp(initLineClamp)
            setFold(true)
          }}
          onExpand={() => {
            setLineClamp(0)
            setFold(false)
          }}
        />
      ) : (
        <div className={cn(mode === 'article' ? 'w-auto' : 'w-4')} />
      )}
    </div>
  )
}

export default ArtimentBody
