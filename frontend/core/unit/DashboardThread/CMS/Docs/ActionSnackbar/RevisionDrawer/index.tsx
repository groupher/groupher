import type { TRichEditorDiffResult, TRichEditorDiffValue } from '@groupher/rich-editor/diff'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'

import TYPE from '~/const/type'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import ArrowSimpleSVG from '~/icons/ArrowSimple'
import CloseLightSVG from '~/icons/CloseLight'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'
import RichEditorDiff from '~/unit/RichEditor/Diff'
import Drawer from '~/widgets/Drawer'
import { SegmentTab } from '~/widgets/Switcher'
import { toast } from '~/widgets/Toaster'

import useDocsEditor from '../../Editor/store/hooks'
import { REVISION_LABEL_KEY } from '../constant'
import type { TRevisionDiffScope } from './diffClient'
import type { TRevisionDiffModel, TRevisionDiffPair } from './model'
import RevisionItem from './RevisionItem'
import useSalon, { cn } from './salon'
import type { TRevisionDiffTab } from './useRevisionDiffModel'

type TProps = {
  error: string | null
  loading: boolean
  revisionDiffModel: TRevisionDiffModel
  show: boolean
  loadDiffResult: (
    pair: TRevisionDiffPair,
    scope?: TRevisionDiffScope,
  ) => Promise<TRichEditorDiffResult | null>
  startHistoryDiff: (tab: TRevisionDiffTab) => () => void
  onClose: () => void
  onReload: () => Promise<void>
}

const CURRENT_CHANGES_KEY = 'current'

const REVISION_TABS = [
  { labelKey: REVISION_LABEL_KEY.STAGED_TAB, key: 'staged' },
  { labelKey: REVISION_LABEL_KEY.PUBLISHED_TAB, key: 'published' },
] as const

const RevisionDrawer: FC<TProps> = ({
  error,
  loading,
  revisionDiffModel,
  show,
  loadDiffResult,
  startHistoryDiff,
  onClose,
  onReload,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()
  const { docDraftInfo, reloadDocDraft, saveStatus } = useDocsEditor()
  const [activeTab, setActiveTab] = useState<TRevisionDiffTab>('staged')
  const [selectedKey, setSelectedKey] = useState(CURRENT_CHANGES_KEY)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [selectedDiffValue, setSelectedDiffValue] = useState<TRichEditorDiffValue | null>(null)
  const docDraftId = docDraftInfo.id

  useEffect(() => {
    setSelectedKey((currentKey) => {
      if (currentKey === CURRENT_CHANGES_KEY) return currentKey
      if (
        [...revisionDiffModel.stagedEntries, ...revisionDiffModel.publishedEntries].some(
          ({ revision }) => revision.id === currentKey,
        )
      ) {
        return currentKey
      }
      return activeTab === 'staged' ? CURRENT_CHANGES_KEY : ''
    })
  }, [activeTab, revisionDiffModel.publishedEntries, revisionDiffModel.stagedEntries])

  const restoreRevision = useCallback(
    async (revisionId: string) => {
      if (!docDraftId || restoringId) return

      setRestoringId(revisionId)

      try {
        await mutate(S.restoreDocDraftSnapshot, {
          community,
          id: docDraftId,
          snapshotId: revisionId,
        })
        toast(t(REVISION_LABEL_KEY.RESTORED))
        reloadDocDraft?.()
        await onReload()
      } catch (err) {
        const message = err instanceof Error ? err.message : t(REVISION_LABEL_KEY.RESTORE_FAILED)
        toast(message, 'error')
      } finally {
        setRestoringId(null)
      }
    },
    [community, docDraftId, mutate, onReload, reloadDocDraft, restoringId, t],
  )

  const restoreDisabled = saveStatus !== 'saved'
  const activeRevisionEntries =
    activeTab === 'staged' ? revisionDiffModel.stagedEntries : revisionDiffModel.publishedEntries
  const selectedRevisionEntry = useMemo(
    () => activeRevisionEntries.find(({ revision }) => revision.id === selectedKey),
    [activeRevisionEntries, selectedKey],
  )
  const hasCurrentDiff = activeTab === 'staged' && revisionDiffModel.current.hasChanges
  const currentChangesSelected = selectedKey === CURRENT_CHANGES_KEY
  const showCurrentDiff = show && hasCurrentDiff && currentChangesSelected
  const selectedPair =
    showCurrentDiff && !revisionDiffModel.current.pending
      ? revisionDiffModel.current
      : selectedRevisionEntry
  const selectedScope: TRevisionDiffScope = showCurrentDiff ? 'current' : 'history'
  const activePending =
    activeTab === 'staged' ? revisionDiffModel.stagedPending : revisionDiffModel.publishedPending
  const hasVisibleDiff = activeRevisionEntries.length > 0 || hasCurrentDiff

  useEffect(() => {
    if (!show) return
    return startHistoryDiff(activeTab)
  }, [activeTab, show, startHistoryDiff])

  useEffect(() => {
    if (!show || !selectedPair) {
      setSelectedDiffValue(null)
      return
    }

    let cancelled = false
    setSelectedDiffValue(null)
    void loadDiffResult(selectedPair, selectedScope).then((result) => {
      if (!cancelled) setSelectedDiffValue(result?.diffValue || null)
    })

    return () => {
      cancelled = true
    }
  }, [loadDiffResult, selectedPair, selectedScope, show])

  return (
    <Drawer show={show} onClose={onClose} type={TYPE.DRAWER.DOC_REVISION}>
      <div className={s.wrapper}>
        <div className={s.header}>
          <div className={s.titleGroup}>
            <div className={s.title}>{t(REVISION_LABEL_KEY.TITLE)}</div>
            <div className={s.subtitle}>{docDraftInfo.title}</div>
          </div>
          <button
            type='button'
            className={s.closeButton}
            aria-label={t(REVISION_LABEL_KEY.CLOSE)}
            onClick={onClose}
          >
            <CloseLightSVG className={s.closeIcon} />
          </button>
        </div>

        <div className={s.body}>
          <div className={s.tabs}>
            <SegmentTab
              items={REVISION_TABS.map((item) => ({
                key: item.key,
                label: t(item.labelKey),
              }))}
              activeKey={activeTab}
              ariaLabel={t(REVISION_LABEL_KEY.TITLE)}
              className={s.tabControl}
              itemClassName={s.tabItem}
              onChange={(key) => setActiveTab(key as TRevisionDiffTab)}
            />
          </div>

          {activeTab === 'staged' && hasCurrentDiff && (
            <div
              className={cn(
                s.currentChangesCard,
                currentChangesSelected && s.currentChangesCardActive,
              )}
            >
              <button
                type='button'
                className={s.currentChangesButton}
                aria-expanded={currentChangesSelected}
                onClick={() => {
                  setSelectedKey((key) => (key === CURRENT_CHANGES_KEY ? '' : CURRENT_CHANGES_KEY))
                }}
              >
                <span className={s.currentChangesSummary}>
                  <span>Now</span>
                  <span className={s.additions}>+{revisionDiffModel.current.stats.additions}</span>
                  <span className={s.deletions}>-{revisionDiffModel.current.stats.deletions}</span>
                </span>
                <span
                  className={cn(s.toggleIcon, currentChangesSelected && s.toggleIconExpanded)}
                  aria-hidden='true'
                >
                  <ArrowSimpleSVG className={s.toggleIconSvg} />
                </span>
              </button>

              {showCurrentDiff && selectedDiffValue && (
                <div className={s.inlineDiff}>
                  <RichEditorDiff diffValue={selectedDiffValue} />
                </div>
              )}
            </div>
          )}

          {restoreDisabled && (
            <div className={s.restoreHint}>{t(REVISION_LABEL_KEY.SAVE_BEFORE_RESTORE)}</div>
          )}

          {loading && <div className={s.stateBox}>{t(REVISION_LABEL_KEY.LOADING)}</div>}
          {!loading && !error && activePending && (
            <div className={s.stateBox}>{t(REVISION_LABEL_KEY.LOADING)}</div>
          )}
          {!loading && error && (
            <div className={s.errorBox}>{t(REVISION_LABEL_KEY.LOAD_FAILED)}</div>
          )}
          {!loading && !error && !activePending && !hasVisibleDiff && (
            <div className={s.stateBox}>{t(REVISION_LABEL_KEY.EMPTY)}</div>
          )}
          {!loading && !error && activeRevisionEntries.length > 0 && (
            <div className={s.list}>
              {activeRevisionEntries.map(({ revision, stats }) => {
                const selected = revision.id === selectedKey
                return (
                  <RevisionItem
                    key={revision.id}
                    revision={revision}
                    selected={selected}
                    restoreDisabled={restoreDisabled}
                    restoring={restoringId === revision.id}
                    stats={stats}
                    onSelect={(revisionId) =>
                      setSelectedKey((key) => (key === revisionId ? '' : revisionId))
                    }
                    onRestore={restoreRevision}
                  >
                    {selected && selectedDiffValue && (
                      <RichEditorDiff diffValue={selectedDiffValue} />
                    )}
                  </RevisionItem>
                )
              })}
            </div>
          )}
          {!loading &&
            !error &&
            activeTab === 'staged' &&
            revisionDiffModel.hiddenDraftDuplicateCount > 0 && (
              <div className={s.hiddenNote}>
                {revisionDiffModel.hiddenDraftDuplicateCount}{' '}
                {t(REVISION_LABEL_KEY.HIDDEN_DUPLICATES)}
              </div>
            )}
        </div>
      </div>
    </Drawer>
  )
}

export default RevisionDrawer
