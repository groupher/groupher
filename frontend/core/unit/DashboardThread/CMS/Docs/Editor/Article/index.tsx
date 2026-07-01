import { useEffect, useState, type FC } from 'react'

import { DOC_STAGE, DSB_DOC_EVENT, type TDocPublishSuccessPayload } from '~/const/dsb/docs'
import useEvent from '~/hooks/useEvent'

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
    editable,
    editorDocId,
    error,
    loading,
    setBodyValue,
    setSubtitle,
    setTitle,
    subtitle,
    title,
  } = useLogic(sideTree)
  const [coverVisible, setCoverVisible] = useState(false)
  const disabled = loading || !editable || mode === DOC_EDITOR_MODE.PREVIEW

  useEffect(() => {
    setCoverVisible(false)
  }, [activePage?.docId])

  useEvent<TDocPublishSuccessPayload>(
    DSB_DOC_EVENT.PUBLISH_SUCCESS,
    (_msg, payload): void => {
      if (!activePage?.docId || !payload?.docIds.includes(activePage.docId)) return

      sideTree.patchChild(activePage.id, {
        publishState: {
          ...(activePage.publishState ?? {}),
          hasDraft: false,
          hasUnpublishedChanges: false,
          published: true,
          status: DOC_STAGE.PUBLIC,
        },
      })
    },
    [activePage?.docId, activePage?.id, activePage?.publishState, sideTree],
  )

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
        docId={activePage.docId}
        publishState={activePage.publishState}
        onChange={setTitle}
      />
      <Subtitle value={subtitle} disabled={disabled} onChange={setSubtitle} />
      <Body
        value={bodyValue}
        mode={mode}
        editorKey={editorDocId}
        disabled={disabled}
        onChange={setBodyValue}
      />
      {error && <div className={s.error}>{error}</div>}
      <Footer />
    </article>
  )
}

export default Article
