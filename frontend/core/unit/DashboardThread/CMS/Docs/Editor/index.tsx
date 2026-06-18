'use client'

import type { FC } from 'react'
import { Group as PanelGroup, Panel, Separator } from 'react-resizable-panels'

import ActionSnackbar from '../ActionSnackbar'
import Article from './Article'
import useSalon from './salon'
import SideTree from './SideTree'
import useSideTree from './SideTree/useSideTree'
import DocsEditorStoreProvider from './store/provider'

const Editor: FC = () => {
  const s = useSalon()
  const sideTree = useSideTree()

  return (
    <DocsEditorStoreProvider initData={{ sideTree }}>
      <div className={s.wrapper}>
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
            <Article sideTree={sideTree} />
          </Panel>
        </PanelGroup>
        <ActionSnackbar />
      </div>
    </DocsEditorStoreProvider>
  )
}

export default Editor
