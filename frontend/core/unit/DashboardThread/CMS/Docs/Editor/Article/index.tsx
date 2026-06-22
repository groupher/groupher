import type { FC } from 'react'

import type { TSideTreeController } from '../SideTree/useSideTree'
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
  const { activePage, bodyValue, editable, error, loading, setBodyValue, setTitle, slug, title } =
    useLogic(sideTree, initialDraft)

  if (!activePage) {
    return (
      <article className={s.wrapper}>
        <div className={s.empty}>选择一个文档页面开始编辑</div>
      </article>
    )
  }

  if (!editable) {
    return (
      <article className={s.wrapper}>
        <div className={s.empty}>当前页面缺少 docId</div>
      </article>
    )
  }

  return (
    <article className={s.wrapper}>
      <Cover />
      <Title value={title} disabled={loading} onChange={setTitle} />
      <Body
        value={bodyValue}
        editorKey={activePage.docId}
        disabled={loading}
        onChange={setBodyValue}
      />
      <div className={s.statusBar}>
        {slug && <span className={s.slug}>/{slug}</span>}
        {error && <span className={s.error}>{error}</span>}
      </div>
      <Footer />
    </article>
  )
}

export default Article
