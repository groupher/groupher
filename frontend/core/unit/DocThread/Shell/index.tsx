import useMobileDetect from '@groupher/use-mobile-detect-hook'
import type { FC, ReactNode } from 'react'
import { Group as PanelGroup, Panel } from 'react-resizable-panels'

import type { TDocPublicTree } from '~/spec'

import Tree from '../Tree'
import useSalon from './salon'

type TProps = {
  children: ReactNode
  tree: TDocPublicTree
}

const Shell: FC<TProps> = ({ children, tree }) => {
  const s = useSalon()
  const { isMobile } = useMobileDetect()
  const hasTree = tree.groups.length > 0

  if (isMobile) {
    return (
      <div className={s.mobileWrapper}>
        {hasTree && (
          <div className={s.mobileTree}>
            <Tree groups={tree.groups} compact />
          </div>
        )}
        <main className={s.mobileContent}>{children}</main>
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      <PanelGroup
        className={s.panelGroup}
        orientation='horizontal'
        resizeTargetMinimumSize={{ fine: 12, coarse: 28 }}
      >
        {hasTree && (
          <Panel
            id='docs-public-tree'
            className={s.sidePanel}
            defaultSize={200}
            minSize={200}
            maxSize={280}
            groupResizeBehavior='preserve-pixel-size'
          >
            <Tree groups={tree.groups} />
          </Panel>
        )}

        <Panel id='docs-public-content' className={s.contentPanel} minSize={0}>
          <main className={s.contentRail}>{children}</main>
        </Panel>
      </PanelGroup>
    </div>
  )
}

export default Shell
