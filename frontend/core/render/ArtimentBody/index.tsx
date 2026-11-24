/*
 * ArtimentBody
 */
import { type FC, useLayoutEffect, useRef, useState } from 'react'

import type { TDocument } from '~/spec'

import FoldBox from './FoldBox'
import useSalon, { cn } from './salon'

type TProps = {
  testid?: string
  document: TDocument
  // 超过多行就默认折叠
  initLineClamp?: number
  mode?: 'article' | 'comment'
}

type TFoldState = {
  fold: boolean
  needFold: boolean
  lineClamp: number
}

const ArtimentBody: FC<TProps> = ({
  testid = 'article-body',
  document: doc,
  initLineClamp = 15,
  mode = 'article',
}) => {
  const s = useSalon()
  const isRichReadonly = mode === 'article' && !!doc?.json

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [foldState, setFoldState] = useState<TFoldState>({
    fold: false,
    needFold: false,
    lineClamp: initLineClamp,
  })
  const { fold, needFold, lineClamp } = foldState

  useLayoutEffect(() => {
    if (isRichReadonly) {
      setFoldState({ fold: false, needFold: false, lineClamp: initLineClamp })
      return
    }

    const body = bodyRef.current
    if (!body) return

    const shouldFold = body.scrollHeight - body.clientHeight > 22

    setFoldState({
      fold: shouldFold,
      needFold: shouldFold,
      lineClamp: initLineClamp,
    })
  }, [doc.html, initLineClamp, isRichReadonly])

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
        <div
          data-testid={testid}
          className={s.html}
          // oxlint-disable-next-line react/no-danger -- Article HTML is rendered from sanitized rich-text output.
          dangerouslySetInnerHTML={{ __html: doc.html || '' }}
        />
      </div>

      {needFold ? (
        <FoldBox
          fold={fold}
          mode={mode}
          onFold={() => {
            setFoldState((state) => ({ ...state, fold: true, lineClamp: initLineClamp }))
          }}
          onExpand={() => {
            setFoldState((state) => ({ ...state, fold: false, lineClamp: 0 }))
          }}
        />
      ) : (
        <div className={mode === 'article' ? 'w-auto' : 'w-4'} />
      )}
    </div>
  )
}

export default ArtimentBody
