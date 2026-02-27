/* eslint-disable react/no-danger */
/*
 * ArtimentBody
 */
import { type FC, useState } from 'react'

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

const ArtimentBody: FC<TProps> = ({
  testid = 'article-body',
  document,
  initLineClamp = 15,
  mode = 'article',
}) => {
  const s = useSalon()

  const [fold, setFold] = useState(true)
  const needFold = document.bodyHtml.length > 220
  const lineClamp = fold ? initLineClamp : 0

  return (
    <div className={s.wrapper}>
      <div
        className={cn(
          s.body,
          `line-clamp-[${lineClamp}]`,
          mode === 'article' ? 'text-base' : 'text-sm',
        )}
      >
        <div
          className={s.html}
          dangerouslySetInnerHTML={{
            __html: document.bodyHtml,
          }}
        />
      </div>

      {needFold ? (
        <FoldBox
          fold={fold}
          mode={mode}
          onFold={() => {
            setFold(true)
          }}
          onExpand={() => {
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
