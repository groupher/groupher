'use client'

import type { FC } from 'react'
import { Group as PanelGroup, Panel, Separator } from 'react-resizable-panels'

import Article from './Article'
import useSalon from './salon'
import SideTree from './SideTree'

const Editor: FC = () => {
  const s = useSalon()

  return (
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
        <SideTree />
      </Panel>

      <Separator id='docs-side-tree-resizer' className={s.resizeHandle}>
        <div className={s.resizeLine} />
      </Separator>

      <Panel id='docs-editor-space' className={s.fillPanel} minSize={0}>
        <Article />
      </Panel>
    </PanelGroup>
  )
}

export default Editor
