import useMobileDetect from '@groupher/use-mobile-detect-hook'
import type { FC, ReactNode } from 'react'
import { useState } from 'react'
import { Group as PanelGroup, Panel } from 'react-resizable-panels'

import type { TDocPublicTree } from '~/spec'
import ArticleToc from '~/widgets/ArticleToc'

import Tree from '../Tree'
import { DOC_ARTICLE_TOC_ACTIVE_ID, DOC_ARTICLE_TOC_ITEMS } from './constant'
import useSalon from './salon'

type TProps = {
  children: ReactNode
  tree: TDocPublicTree
}

const Shell: FC<TProps> = ({ children, tree }) => {
  const [activeTocId, setActiveTocId] = useState<string | null>(DOC_ARTICLE_TOC_ACTIVE_ID)
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
      <div className={s.articleToc}>
        <div className={s.articleTocSticky}>
          <ArticleToc
            items={DOC_ARTICLE_TOC_ITEMS}
            activeId={activeTocId}
            onSelect={(item) => setActiveTocId(item.id)}
          />
        </div>
      </div>
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
