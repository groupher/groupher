import useMobileDetect from '@groupher/use-mobile-detect-hook'
import { usePathname } from 'next/navigation'
import type { FC, KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { TDocPublicTree, TDocPublicTreeGroup, TDocPublicTreeNavigationNode } from '~/spec'
import ArticleToc from '~/widgets/ArticleToc'

import Tabs from '../Tabs'
import Tree from '../Tree'
import { DOC_PUBLIC_TREE_LABEL, DOC_PUBLIC_TREE_WIDTH } from '../Tree/constant'
import { DOC_PUBLIC_TREE_STICKY_HEIGHT, DOC_PUBLIC_TREE_STICKY_TOP } from '../Tree/salon/layout'
import TreeToc from '../TreeToc'
import { DOC_ARTICLE_TOC_ACTIVE_ID, DOC_ARTICLE_TOC_ITEMS } from './constant'
import { clampDocPublicTreeWidth } from './helper'
import useSalon from './salon'

type TProps = {
  children: ReactNode
  tree: TDocPublicTree
}

type TResizeState = {
  startWidth: number
  startX: number
}

const SIDE_RAIL_STYLE = {
  height: DOC_PUBLIC_TREE_STICKY_HEIGHT,
  top: DOC_PUBLIC_TREE_STICKY_TOP,
}

const containsHref = (nodes: readonly TDocPublicTreeNavigationNode[], href: string): boolean =>
  nodes.some((node) => {
    if (node.href === href) return true
    if (String(node.type).toLowerCase() !== 'group') return false
    return containsHref((node as TDocPublicTreeGroup).pages ?? [], href)
  })

const collectGroups = (nodes: readonly TDocPublicTreeNavigationNode[]): TDocPublicTreeGroup[] =>
  nodes.flatMap((node) =>
    String(node.type).toLowerCase() === 'group'
      ? [node as TDocPublicTreeGroup, ...collectGroups((node as TDocPublicTreeGroup).pages ?? [])]
      : [],
  )

const Shell: FC<TProps> = ({ children, tree }) => {
  const pathname = usePathname()
  const [treeOpen, setTreeOpen] = useState(true)
  const [treeWidth, setTreeWidth] = useState<number>(DOC_PUBLIC_TREE_WIDTH.default)
  const [activeTocId, setActiveTocId] = useState<string | null>(DOC_ARTICLE_TOC_ACTIVE_ID)
  const [activeTabId, setActiveTabId] = useState<string | null>(tree.tabs[0]?.id ?? null)
  const resizeStateRef = useRef<TResizeState>({
    startWidth: DOC_PUBLIC_TREE_WIDTH.default,
    startX: 0,
  })
  const s = useSalon({ treeOpen })
  const { isMobile } = useMobileDetect()
  const activeTab = useMemo(
    () => tree.tabs.find((tab) => tab.id === activeTabId) ?? tree.tabs[0] ?? null,
    [activeTabId, tree.tabs],
  )
  const nodes = activeTab?.groups ?? []
  const groups = collectGroups(nodes)
  const hasTree = nodes.length > 0
  const sidePanelStyle = {
    width: treeWidth,
  }

  useEffect(() => {
    const matchingTab = tree.tabs.find((tab) => containsHref(tab.groups, pathname))
    if (matchingTab) setActiveTabId(matchingTab.id)
  }, [pathname, tree.tabs])

  const handleResizePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!treeOpen) return

    event.preventDefault()
    resizeStateRef.current = {
      startWidth: treeWidth,
      startX: event.clientX,
    }

    const handlePointerMove = (moveEvent: globalThis.PointerEvent): void => {
      const { startWidth, startX } = resizeStateRef.current
      setTreeWidth(clampDocPublicTreeWidth(startWidth + moveEvent.clientX - startX))
    }

    const handlePointerEnd = (): void => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd, { once: true })
    window.addEventListener('pointercancel', handlePointerEnd, { once: true })
  }

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!treeOpen) return

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    setTreeWidth((width) =>
      clampDocPublicTreeWidth(width + direction * DOC_PUBLIC_TREE_WIDTH.keyboardStep),
    )
  }

  if (isMobile) {
    return (
      <div className={s.mobileWrapper}>
        {hasTree && (
          <div className={s.mobileTree}>
            <Tree nodes={nodes} compact />
          </div>
        )}
        <main className={s.mobileContent}>{children}</main>
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      <Tabs activeTabId={activeTab?.id ?? null} tabs={tree.tabs} onSelect={setActiveTabId} />
      <div className={s.articleToc}>
        <div className={s.articleTocSticky}>
          <ArticleToc
            items={DOC_ARTICLE_TOC_ITEMS}
            activeId={activeTocId}
            onSelect={(item) => setActiveTocId(item.id)}
          />
        </div>
      </div>
      <div className={s.layout}>
        {hasTree && (
          <aside className={s.sideRail} style={SIDE_RAIL_STYLE}>
            {treeOpen ? (
              <div className={s.sidePanel} style={sidePanelStyle}>
                <Tree nodes={nodes} onToggleTree={() => setTreeOpen(false)} />
              </div>
            ) : (
              <div className={s.collapsedPanel}>
                <TreeToc groups={groups} onOpenTree={() => setTreeOpen(true)} />
              </div>
            )}
            {treeOpen && (
              <div
                className={s.resizeHandle}
                role='separator'
                aria-label={DOC_PUBLIC_TREE_LABEL.resizeTree}
                aria-orientation='vertical'
                aria-valuemax={DOC_PUBLIC_TREE_WIDTH.max}
                aria-valuemin={DOC_PUBLIC_TREE_WIDTH.min}
                aria-valuenow={treeWidth}
                tabIndex={0}
                onKeyDown={handleResizeKeyDown}
                onPointerDown={handleResizePointerDown}
              >
                <div className={s.resizeLine} />
              </div>
            )}
          </aside>
        )}

        <main className={s.contentRail}>{children}</main>
      </div>
    </div>
  )
}

export default Shell
