'use client'

import type { FC } from 'react'
import { Group as PanelGroup, Panel, Separator } from 'react-resizable-panels'

import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import useEvent from '~/hooks/useEvent'
import { useDsbShellUi } from '~/stores/dsbShellUi'

import ActionSnackbar from '../ActionSnackbar'
import AddTabPortal from './AddTabPortal'
import Article from './Article'
import DocsEditorCommandsProvider from './commands/provider'
import useSalon from './salon'
import { DOC_EDITOR_SNACKBAR_STICKY_TOP } from './salon/layout'
import SideTree from './SideTree'
import ConfirmDeleteModal from './SideTree/ConfirmDeleteModal'
import useSideTreeLogic from './SideTree/useLogic'
import { hasTreeChanges } from './store'
import Tabs from './Tabs'

const EditorContent: FC = () => {
  const { submenuCollapsed } = useDsbShellUi()
  const sideTree = useSideTreeLogic()
  const showTabs = sideTree.tabs.length > 0
  const s = useSalon({ showTabs, submenuCollapsed })
  const showSideTree = sideTree.activeTabId !== null
  const sideTreeViewportLayoutKey = `${showTabs}:${submenuCollapsed}`
  const showActionSnackbar = sideTree.activeId !== null || hasTreeChanges(sideTree)

  useEvent(DSB_DOC_EVENT.ADD_TAB, sideTree.addTab, [sideTree.addTab])

  return (
    <DocsEditorCommandsProvider sideTree={sideTree}>
      <>
        <ConfirmDeleteModal
          message={sideTree.deleteConfirmation}
          onConfirm={() => sideTree.finishDeleteConfirmation(true)}
          onCancel={() => sideTree.finishDeleteConfirmation(false)}
        />
        <AddTabPortal show={!showTabs} />
        <div className={s.wrapper}>
          <Tabs controller={sideTree} showTabs={showTabs} submenuCollapsed={submenuCollapsed} />
          <div className={s.surface}>
            <PanelGroup
              className={s.panelGroup}
              orientation='horizontal'
              resizeTargetMinimumSize={{ fine: 12, coarse: 28 }}
            >
              {showSideTree && (
                <Panel
                  id='docs-side-tree'
                  className={s.sidePanel}
                  defaultSize={180}
                  minSize={120}
                  maxSize={210}
                  groupResizeBehavior='preserve-pixel-size'
                >
                  <SideTree controller={sideTree} viewportLayoutKey={sideTreeViewportLayoutKey} />
                </Panel>
              )}

              {showSideTree && (
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
      </>
    </DocsEditorCommandsProvider>
  )
}

export default EditorContent
