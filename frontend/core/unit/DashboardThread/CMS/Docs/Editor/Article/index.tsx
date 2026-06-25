import { useEffect, useState, type FC } from 'react'

import { DOC_EDITOR_MODE } from '../constant'
import type { TSideTreeController } from '../SideTree/spec'
import useDocsEditor from '../store/hooks'
import Body from './Body'
import Cover from './Cover'
import Footer from './Footer'
import useSalon from './salon'
import type { TDocDraftInitialData } from './spec'
import Subtitle from './Subtitle'
import Title from './Title'
import TitleActions from './TitleActions'
import useLogic from './useLogic'
import WorkspaceActions from './WorkspaceActions'

type TProps = {
  sideTree: TSideTreeController
  initialDraft?: TDocDraftInitialData | null
}

const Article: FC<TProps> = ({ sideTree, initialDraft }) => {
  const s = useSalon()
  const { mode } = useDocsEditor()
  const {
    activePage,
    bodyValue,
    error,
    loading,
    setBodyValue,
    setSubtitle,
    setTitle,
    subtitle,
    title,
  } = useLogic(sideTree, initialDraft)
  const [coverVisible, setCoverVisible] = useState(false)
  const disabled = loading || mode === DOC_EDITOR_MODE.PREVIEW

  useEffect(() => {
    setCoverVisible(false)
  }, [activePage?.docId])

  if (!activePage) {
    return (
      <article className={s.wrapper}>
        <WorkspaceActions onAddGroup={sideTree.addGroup} />
      </article>
    )
  }

  return (
    <article className={s.wrapper}>
      {coverVisible && <Cover />}
      <TitleActions
        coverVisible={coverVisible}
        disabled={disabled}
        onAddCover={() => setCoverVisible(true)}
      />
      <Title value={title} disabled={disabled} onChange={setTitle} />
      <Subtitle value={subtitle} disabled={disabled} onChange={setSubtitle} />
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
