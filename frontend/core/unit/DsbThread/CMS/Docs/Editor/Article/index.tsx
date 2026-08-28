import type { TRichEditorHandle } from '@groupher/rich-editor'
import { useRef, type FC } from 'react'

import { ARTICLE_STAGE } from '~/const/article'
import { DSB_DOC_EVENT, type TDocPublishSuccessPayload } from '~/const/dsb/docs'
import useEvent from '~/hooks/useEvent'

import { DOC_EDITOR_MODE } from '../constant'
import ImportDrawer from '../Import/Drawer'
import useImport from '../Import/useImport'
import type { TSideTreeController } from '../SideTree/spec'
import useDocsEditor from '../store/hooks'
import Body from './Body'
import Cover from './Cover'
import useCover from './Cover/useCover'
import Footer from './Footer'
import useLogic from './hooks/useLogic'
import useSalon from './salon'
import type { TDocDraftInitialData } from './spec'
import Title from './Title'
import Subtitle from './Title/Subtitle'
import TitleActions from './TitleActions'
import WorkspaceActions from './WorkspaceActions'

type TProps = {
  initialData?: TDocDraftInitialData | null
  sideTree: TSideTreeController
}

const Article: FC<TProps> = ({ initialData, sideTree }) => {
  const s = useSalon()
  const { mode } = useDocsEditor()
  const editorRef = useRef<TRichEditorHandle | null>(null)
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
  } = useLogic(sideTree, initialData)
  const docId = activePage?.docId ?? ''
  const coverVisible = useCover(docId)
  const docImport = useImport({ docId, editorRef })
  const controlsDisabled = loading || !editable || mode === DOC_EDITOR_MODE.PREVIEW
  const editorDisabled = loading || !editable
  const editorReady = !!docId && editorDocId === docId && !loading

  useEvent<TDocPublishSuccessPayload>(
    DSB_DOC_EVENT.PUBLISH_SUCCESS,
    (_msg, payload): void => {
      if (!docId || !activePage || !payload?.docIds.includes(docId)) return

      sideTree.patchChild(activePage.id, {
        publishState: {
          ...(activePage.publishState ?? {}),
          hasDraft: false,
          hasUnpublishedChanges: false,
          published: true,
          status: ARTICLE_STAGE.PUBLIC,
        },
      })
    },
    [activePage, docId, sideTree],
  )

  if (!activePage) {
    return (
      <article className={s.wrapper}>
        <WorkspaceActions onAddGroup={sideTree.addGroup} />
      </article>
    )
  }

  return (
    <>
      <article className={s.wrapper}>
        {coverVisible ? <Cover /> : null}
        <TitleActions coverVisible={coverVisible} disabled={controlsDisabled} docId={docId} />
        <Title
          value={title}
          disabled={controlsDisabled}
          docId={docId}
          publishState={activePage.publishState}
          onChange={setTitle}
        />
        <Subtitle value={subtitle} disabled={controlsDisabled} onChange={setSubtitle} />
        {editorReady ? (
          <Body
            ref={editorRef}
            editorKey={editorDocId}
            value={bodyValue}
            mode={mode}
            disabled={editorDisabled}
            onChange={setBodyValue}
          />
        ) : null}
        {error ? <div className={s.error}>{error}</div> : null}
        <Footer />
      </article>
      <ImportDrawer
        show={docImport.show}
        targetDocId={docImport.targetDocId}
        editor={docImport.editor}
        cursor={docImport.cursor}
        onClose={docImport.close}
        onInserted={docImport.handleInserted}
      />
    </>
  )
}

export default Article
