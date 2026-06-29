import { useEffect, useState, type FC } from 'react'

import { DOC_EDITOR_MODE } from '../constant'
import type { TSideTreeController } from '../SideTree/spec'
import useDocsEditor from '../store/hooks'
import Body from './Body'
import Cover from './Cover'
import Footer from './Footer'
import useSalon from './salon'
import Title from './Title'
import Subtitle from './Title/Subtitle'
import TitleActions from './TitleActions'
import useLogic from './useLogic'
import WorkspaceActions from './WorkspaceActions'

type TProps = {
  sideTree: TSideTreeController
}

const Article: FC<TProps> = ({ sideTree }) => {
  const s = useSalon()
  const { mode } = useDocsEditor()
  const {
    activePage,
    bodyValue,
    editorWorkspaceId,
    error,
    loading,
    setBodyValue,
    setSubtitle,
    setTitle,
    subtitle,
    title,
  } = useLogic(sideTree)
  const [coverVisible, setCoverVisible] = useState(false)
  const disabled = loading || mode === DOC_EDITOR_MODE.PREVIEW

  useEffect(() => {
    setCoverVisible(false)
  }, [activePage?.workspaceId])

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
      <Title
        value={title}
        disabled={disabled}
        publishState={activePage.publishState}
        onChange={setTitle}
      />
      <Subtitle value={subtitle} disabled={disabled} onChange={setSubtitle} />
      <Body
        value={bodyValue}
        mode={mode}
        editorKey={editorWorkspaceId}
        disabled={loading}
        onChange={setBodyValue}
      />
      {error && <div className={s.error}>{error}</div>}
      <Footer />
    </article>
  )
}

export default Article
