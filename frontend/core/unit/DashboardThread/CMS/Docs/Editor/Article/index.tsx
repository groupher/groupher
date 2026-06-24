import type { FC } from 'react'

import { DOC_EDITOR_MODE } from '../constant'
import type { TSideTreeController } from '../SideTree/spec'
import useDocsEditor from '../store/hooks'
import Body from './Body'
import Cover from './Cover'
import Footer from './Footer'
import useSalon from './salon'
import type { TDocDraftInitialData } from './spec'
import Title from './Title'
import useLogic from './useLogic'

type TProps = {
  sideTree: TSideTreeController
  initialDraft?: TDocDraftInitialData | null
}

const Article: FC<TProps> = ({ sideTree, initialDraft }) => {
  const s = useSalon()
  const { mode } = useDocsEditor()
  const { activePage, bodyValue, error, loading, setBodyValue, setTitle, title } = useLogic(
    sideTree,
    initialDraft,
  )

  if (!activePage) {
    return (
      <article className={s.wrapper}>
        <div className={s.empty}>选择一个文档页面开始编辑</div>
      </article>
    )
  }

  return (
    <article className={s.wrapper}>
      <Cover />
      <Title
        value={title}
        disabled={loading || mode === DOC_EDITOR_MODE.PREVIEW}
        onChange={setTitle}
      />
      <Body
        value={bodyValue}
        mode={mode}
        editorKey={activePage.docId}
        disabled={loading}
        onChange={setBodyValue}
      />
      {error && <div className={s.error}>{error}</div>}
      <Footer />
    </article>
  )
}

export default Article
