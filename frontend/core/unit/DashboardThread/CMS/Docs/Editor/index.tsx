'use client'

import type { FC } from 'react'
import { Group as PanelGroup, Panel, Separator } from 'react-resizable-panels'

import ActionSnackbar from '../ActionSnackbar'
import Article from './Article'
import type { TDocDraftInitialData } from './Article/spec'
import useSalon from './salon'
import SideTree from './SideTree'
import type { TDocTreeInitialData } from './SideTree/spec'
import useSideTreeLogic from './SideTree/useLogic'
import DocsEditorStoreProvider from './store/provider'

export type TDocsEditorInitialData = {
  docTree?: TDocTreeInitialData | null
  docDraft?: TDocDraftInitialData | null
}

type TProps = {
  initialData?: TDocsEditorInitialData
}

const Editor: FC<TProps> = ({ initialData }) => {
  const s = useSalon()
  const sideTree = useSideTreeLogic(initialData?.docTree ?? undefined)

  return (
    <DocsEditorStoreProvider initData={{ sideTree }}>
      <div className={s.wrapper}>
        <div className={s.surface}>
          <PanelGroup
            className={s.panelGroup}
            orientation='horizontal'
            resizeTargetMinimumSize={{ fine: 12, coarse: 28 }}
          >
            <Panel
              id='docs-side-tree'
              className={s.sidePanel}
              defaultSize={180}
              minSize={120}
              maxSize={210}
              groupResizeBehavior='preserve-pixel-size'
            >
              <SideTree controller={sideTree} />
            </Panel>

            <Separator id='docs-side-tree-resizer' className={s.resizeHandle}>
              <div className={s.resizeLine} />
            </Separator>

            <Panel id='docs-editor-space' className={s.fillPanel} minSize={0}>
              <Article sideTree={sideTree} initialDraft={initialData?.docDraft ?? null} />
            </Panel>
          </PanelGroup>

          {sideTree.activeId && (
            <div className={s.snackbarRail} style={{ top: 'calc(100dvh - 7rem)' }}>
              <ActionSnackbar />
            </div>
          )}
        </div>
      </div>
    </DocsEditorStoreProvider>
  )
}

export default Editor
