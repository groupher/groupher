/*
 * ArtimentBody
 */
import { type FC, useLayoutEffect, useRef, useState } from 'react'

import type { TDocument } from '~/spec'

import FoldBox from './FoldBox'
import useSalon, { cn } from './salon'

const RICH_EDITOR_PROBE_TEXT =
  '这是用于验证 Drawer 首屏滚动行为的一段静态占位文本。当前阶段我们不渲染富文本编辑器实例，只保留足够长的内容体积来模拟真实文章阅读场景。第一段用于观察打开预览时是否会自动跳到底部或中部，第二段用于观察切换不同帖子时滚动位置是否会继承旧状态，第三段用于观察动画结束后是否仍有额外抖动。为了避免验证结果被编辑器内部的 selection、focus、range 同步逻辑影响，这里统一使用纯静态文案并保持结构稳定。你可以连续打开多篇帖子，重点看标题是否一开始就出现在视口顶部；如果顶部稳定且没有二次回弹，说明此前问题主要来自富文本组件挂载期间的焦点与选区副作用。若仍然出现偏移，则需要继续排查 Drawer 容器复用、路由切换时机和浏览器滚动锚点策略。该文本没有交互能力，不会主动触发滚动，也不会修改输入状态，仅用于隔离变量和定位根因。'

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
  testid: _testid = 'article-body',
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
  }, [doc.bodyHtml, doc.html, initLineClamp, isRichReadonly])

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
            <div>{RICH_EDITOR_PROBE_TEXT}</div>
          </div>
        ) : (
          <div
            className={s.html}
            // oxlint-disable-next-line react/no-danger -- Article HTML is rendered from sanitized rich-text output.
            dangerouslySetInnerHTML={{
              __html: doc.html || doc.bodyHtml || '',
            }}
          />
        )}
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
