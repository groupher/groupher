'use client'

import type { FC } from 'react'
import { Group as PanelGroup, Panel, Separator } from 'react-resizable-panels'

import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import useEvent from '~/hooks/useEvent'
import useDashboardStore from '~/stores/dashboard/hooks'

import ActionSnackbar from '../ActionSnackbar'
import Article from './Article'
import type { TDocDraftInitialData } from './Article/spec'
import useSalon from './salon'
import { DOC_EDITOR_SNACKBAR_STICKY_TOP } from './salon/layout'
import SideTree from './SideTree'
import type { TDocTreeInitialData } from './SideTree/spec'
import useSideTreeLogic from './SideTree/useLogic'
import { hasTreeChanges } from './store'
import DocsEditorStoreProvider from './store/provider'
import Tabs from './Tabs'

export type TDocsEditorInitialData = {
  docTree?: TDocTreeInitialData | null
  docDraft?: TDocDraftInitialData | null
}

type TProps = {
  initialData?: TDocsEditorInitialData
}

const Editor: FC<TProps> = ({ initialData }) => {
  const { submenuCollapsed } = useDashboardStore()
  const s = useSalon({ submenuCollapsed })
  const sideTree = useSideTreeLogic(initialData?.docTree ?? undefined)
  const hasTree = sideTree.groups.length > 0
  const showActionSnackbar = sideTree.activeId !== null || hasTreeChanges(sideTree)

  useEvent(DSB_DOC_EVENT.ADD_TAB, sideTree.addTab, [sideTree.addTab])

  return (
    <DocsEditorStoreProvider initData={{ sideTree, article: initialData?.docDraft ?? null }}>
      <div className={s.wrapper}>
        <Tabs controller={sideTree} submenuCollapsed={submenuCollapsed} />
        <div className={s.surface}>
          <PanelGroup
            className={s.panelGroup}
            orientation='horizontal'
            resizeTargetMinimumSize={{ fine: 12, coarse: 28 }}
          >
            {hasTree && (
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
            )}

            {hasTree && (
              <Separator id='docs-side-tree-resizer' className={s.resizeHandle}>
                <div className={s.resizeLine} />
              </Separator>
            )}

            <Panel id='docs-editor-space' className={s.fillPanel} minSize={0}>
              <Article sideTree={sideTree} />

              {showActionSnackbar && (
                <div className={s.snackbarRail} style={{ top: DOC_EDITOR_SNACKBAR_STICKY_TOP }}>
                  <ActionSnackbar />
                </div>
              )}
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </DocsEditorStoreProvider>
  )
}

export default Editor
