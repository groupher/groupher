import type { ReactNode } from 'react'

import useTrans from '~/hooks/useTrans'
import { fmtFileSize } from '~/lib/fmt'
import Checker from '~/widgets/Checker'

import useSalon from './salon/source_tree'
import { pageIdsFromNodes, totalPageSize, type TImportPageMeta } from './sourceTreeSelection'
import type { TImportTreeGroup, TImportTreeLeaf, TImportTreeNode, TImportTreeTab } from './spec'

type TProps = {
  pageMeta: Map<string, TImportPageMeta>
  selectedSourceIds: ReadonlySet<string>
  tabs: TImportTreeTab[]
  onToggle: (sourceIds: string[], checked: boolean) => void
}

const stateFor = (
  sourceIds: string[],
  selectedSourceIds: ReadonlySet<string>,
): { checked: boolean; indeterminate: boolean } => {
  const selectedCount = sourceIds.reduce(
    (count, sourceId) => count + (selectedSourceIds.has(sourceId) ? 1 : 0),
    0,
  )
  return {
    checked: sourceIds.length > 0 && selectedCount === sourceIds.length,
    indeterminate: selectedCount > 0 && selectedCount < sourceIds.length,
  }
}

/** Renders recursive TargetTree Groups while preserving sourceId-based selection. */
export default function SourceTree({ pageMeta, selectedSourceIds, tabs, onToggle }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const showTabTitle = tabs.length > 1

  const renderLeaf = (leaf: TImportTreeLeaf): ReactNode => {
    const metadata = pageMeta.get(leaf.sourceId)
    const status = metadata?.draft
      ? t('dsb.doc.bulk_import.review.status.draft')
      : metadata?.navigationStatus === 'unlisted'
        ? t('dsb.doc.bulk_import.review.status.not_in_navigation')
        : null
    const sizeLabel = metadata?.sizeBytes == null ? null : fmtFileSize(metadata.sizeBytes)

    return (
      <div className={s.page} key={leaf.sourceId}>
        {leaf.type === 'page' ? (
          <Checker
            className={s.pageSelection}
            checked={selectedSourceIds.has(leaf.sourceId)}
            aria-label={`${t('dsb.doc.bulk_import.review.select')} ${leaf.title}`}
            onChange={(checked) => onToggle([leaf.sourceId], checked)}
          >
            <span className={s.pageTitle}>{leaf.title}</span>
          </Checker>
        ) : (
          <div className={s.linkRow}>
            <span aria-hidden>↗</span>
            <span className={s.pageTitle}>{leaf.title}</span>
          </div>
        )}
        {leaf.type === 'page' && (status || sizeLabel) ? (
          <span className={s.pageMeta}>
            {status ? (
              <span className={metadata?.draft ? s.draftStatus : s.unlistedStatus}>{status}</span>
            ) : null}
            {status && sizeLabel ? <span className={s.metaDot}>·</span> : null}
            {sizeLabel ? <span className={s.fileSize}>{sizeLabel}</span> : null}
          </span>
        ) : null}
      </div>
    )
  }

  const renderNode = (node: TImportTreeNode): ReactNode =>
    node.type === 'group' ? renderGroup(node) : renderLeaf(node)

  function renderGroup(group: TImportTreeGroup): ReactNode {
    const groupPageIds = pageIdsFromNodes(group.pages)
    const groupState = stateFor(groupPageIds, selectedSourceIds)
    const groupSizeBytes = totalPageSize(groupPageIds, pageMeta)

    return (
      <div className={s.group} key={group.sourceId}>
        <div className={s.groupHeader}>
          {groupPageIds.length > 0 ? (
            <Checker
              className={s.groupSelection}
              checked={groupState.checked}
              indeterminate={groupState.indeterminate}
              aria-label={`${t('dsb.doc.bulk_import.review.select')} ${group.title}`}
              onChange={(checked) => onToggle(groupPageIds, checked)}
            >
              <span className={s.groupTitle}>{group.title}</span>
            </Checker>
          ) : (
            <div className={s.groupTitle}>{group.title}</div>
          )}
          {groupSizeBytes == null ? null : (
            <span className={s.fileSize}>{fmtFileSize(groupSizeBytes)}</span>
          )}
        </div>
        <div className={s.groupChildren}>
          <div aria-hidden className={s.groupDivider} />
          {group.pages.map(renderNode)}
        </div>
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      {tabs.map((tab) => {
        const tabPageIds = pageIdsFromNodes(tab.groups)
        const tabState = stateFor(tabPageIds, selectedSourceIds)

        return (
          <section className={s.tab} key={tab.sourceId}>
            {showTabTitle ? (
              <Checker
                className={s.selectionControl}
                checked={tabState.checked}
                indeterminate={tabState.indeterminate}
                aria-label={`${t('dsb.doc.bulk_import.review.select')} ${tab.title}`}
                onChange={(checked) => onToggle(tabPageIds, checked)}
              >
                <span className={s.tabTitle}>{tab.title}</span>
              </Checker>
            ) : null}
            {tab.groups.map(renderGroup)}
          </section>
        )
      })}
    </div>
  )
}
