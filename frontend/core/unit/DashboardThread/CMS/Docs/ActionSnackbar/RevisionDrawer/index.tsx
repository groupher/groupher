import { type FC, useCallback, useEffect, useMemo, useState } from 'react'

import TYPE from '~/const/type'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import CloseLightSVG from '~/icons/CloseLight'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'
import Drawer from '~/widgets/Drawer'
import { toast } from '~/widgets/Toaster'

import useDocsEditor from '../../Editor/store/hooks'
import { REVISION_LABEL_KEY } from '../constant'
import {
  buildRevisionDiffBlocks,
  computeRevisionDiffStatsFromBlocks,
  dedupeRevisionsBySnapshot,
  EMPTY_REVISION_VALUE,
  parseRevisionDocumentValue,
} from './helper'
import RevisionDiffViewer from './RevisionDiffViewer'
import RevisionItem from './RevisionItem'
import useSalon, { cn } from './salon'
import type { TArticleRevision, TDocDraftRevisionPayload } from './spec'

type TProps = {
  show: boolean
  onClose: () => void
}

type TRevisionTab = 'staged' | 'published'

const CURRENT_CHANGES_KEY = 'current'

const RevisionDrawer: FC<TProps> = ({ show, onClose }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { query, mutate } = useGraphQLClient()
  const { baselineValue, bodyValue, docDraftInfo, reloadDocDraft, saveStatus } = useDocsEditor()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftRevisions, setDraftRevisions] = useState<TArticleRevision[]>([])
  const [publishedRevisions, setPublishedRevisions] = useState<TArticleRevision[]>([])
  const [activeTab, setActiveTab] = useState<TRevisionTab>('staged')
  const [selectedKey, setSelectedKey] = useState(CURRENT_CHANGES_KEY)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const docDraftId = docDraftInfo.id

  const loadRevisions = useCallback(async () => {
    if (!docDraftId) {
      setDraftRevisions([])
      setPublishedRevisions([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [draftData, publishedData] = await Promise.all([
        query<TDocDraftRevisionPayload>(S.docDraftRevisions, {
          community,
          id: docDraftId,
          type: 'DRAFT',
        }),
        query<TDocDraftRevisionPayload>(S.docDraftRevisions, {
          community,
          id: docDraftId,
          type: 'PUBLISHED',
        }),
      ])

      const nextDraftRevisions = draftData?.docDraftRevisions || []
      const nextPublishedRevisions = publishedData?.docDraftRevisions || []
      setDraftRevisions(nextDraftRevisions)
      setPublishedRevisions(nextPublishedRevisions)
      setSelectedKey((currentKey) => {
        if (currentKey === CURRENT_CHANGES_KEY) return currentKey
        if (
          [...nextDraftRevisions, ...nextPublishedRevisions].some(
            (revision) => revision.id === currentKey,
          )
        ) {
          return currentKey
        }
        return CURRENT_CHANGES_KEY
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [community, docDraftId, query])

  useEffect(() => {
    if (!show) return

    void loadRevisions()
  }, [loadRevisions, show])

  useEffect(() => {
    setSelectedKey(activeTab === 'staged' ? CURRENT_CHANGES_KEY : '')
  }, [activeTab])

  const restoreRevision = useCallback(
    async (revisionId: string) => {
      if (!docDraftId || restoringId) return

      setRestoringId(revisionId)

      try {
        await mutate(S.restoreDocDraftRevision, {
          community,
          id: docDraftId,
          revisionId,
        })
        toast(t(REVISION_LABEL_KEY.RESTORED))
        reloadDocDraft?.()
        await loadRevisions()
      } catch (err) {
        const message = err instanceof Error ? err.message : t(REVISION_LABEL_KEY.RESTORE_FAILED)
        toast(message, 'error')
      } finally {
        setRestoringId(null)
      }
    },
    [community, docDraftId, loadRevisions, mutate, reloadDocDraft, restoringId, t],
  )

  const restoreDisabled = saveStatus !== 'saved'
  const { hiddenCount: hiddenDuplicateCount, revisions: visibleDraftRevisions } = useMemo(
    () => dedupeRevisionsBySnapshot(draftRevisions),
    [draftRevisions],
  )
  const visiblePublishedRevisions = publishedRevisions
  const activeRevisions = activeTab === 'staged' ? visibleDraftRevisions : visiblePublishedRevisions
  const latestPublishedRevision = visiblePublishedRevisions[0]
  const currentBaselineValue = useMemo(
    () =>
      visibleDraftRevisions[0]
        ? parseRevisionDocumentValue(visibleDraftRevisions[0].documentJson)
        : latestPublishedRevision
          ? parseRevisionDocumentValue(latestPublishedRevision.documentJson)
          : baselineValue,
    [baselineValue, latestPublishedRevision, visibleDraftRevisions],
  )
  const currentDiffBlocks = useMemo(
    () => buildRevisionDiffBlocks(currentBaselineValue, bodyValue),
    [bodyValue, currentBaselineValue],
  )
  const currentDiffStats = useMemo(
    () => computeRevisionDiffStatsFromBlocks(currentDiffBlocks),
    [currentDiffBlocks],
  )
  const revisionDiffEntries = useMemo(
    () =>
      activeRevisions.map((revision, index) => {
        const previousRevision =
          activeRevisions[index + 1] ||
          (activeTab === 'staged' ? latestPublishedRevision : undefined)
        const previousValue = previousRevision
          ? parseRevisionDocumentValue(previousRevision.documentJson)
          : EMPTY_REVISION_VALUE
        const revisionValue = parseRevisionDocumentValue(revision.documentJson)
        const blocks = buildRevisionDiffBlocks(previousValue, revisionValue)

        return {
          blocks,
          revision,
          stats: computeRevisionDiffStatsFromBlocks(blocks),
        }
      }),
    [activeRevisions, activeTab, latestPublishedRevision],
  )

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
            <button
              type='button'
              className={cn(s.tabButton, activeTab === 'staged' && s.tabButtonActive)}
              onClick={() => setActiveTab('staged')}
            >
              {t(REVISION_LABEL_KEY.STAGED_TAB)}
            </button>
            <button
              type='button'
              className={cn(s.tabButton, activeTab === 'published' && s.tabButtonActive)}
              onClick={() => setActiveTab('published')}
            >
              {t(REVISION_LABEL_KEY.PUBLISHED_TAB)}
            </button>
          </div>

          {activeTab === 'staged' && (
            <>
              <button
                type='button'
                className={cn(
                  s.currentChangesButton,
                  selectedKey === CURRENT_CHANGES_KEY && s.currentChangesButtonActive,
                )}
                onClick={() =>
                  setSelectedKey((key) => (key === CURRENT_CHANGES_KEY ? '' : CURRENT_CHANGES_KEY))
                }
              >
                <span>{t(REVISION_LABEL_KEY.CURRENT_CHANGES)}</span>
                <span className={s.currentChangesMeta}>
                  <span className={s.additions}>+{currentDiffStats.additions}</span>
                  <span className={s.deletions}>-{currentDiffStats.deletions}</span>
                  <span className={s.currentChangesHint}>
                    {t(REVISION_LABEL_KEY.COMPARE_WITH_LATEST_SAVED)}
                  </span>
                </span>
              </button>

              {selectedKey === CURRENT_CHANGES_KEY && (
                <div className={s.inlineDiff}>
                  <RevisionDiffViewer blocks={currentDiffBlocks} />
                </div>
              )}
            </>
          )}

          {restoreDisabled && (
            <div className={s.restoreHint}>{t(REVISION_LABEL_KEY.SAVE_BEFORE_RESTORE)}</div>
          )}

          {loading && <div className={s.stateBox}>{t(REVISION_LABEL_KEY.LOADING)}</div>}
          {!loading && error && (
            <div className={s.errorBox}>{t(REVISION_LABEL_KEY.LOAD_FAILED)}</div>
          )}
          {!loading && !error && activeRevisions.length === 0 && (
            <div className={s.stateBox}>{t(REVISION_LABEL_KEY.EMPTY)}</div>
          )}
          {!loading && !error && activeRevisions.length > 0 && (
            <div className={s.list}>
              {revisionDiffEntries.map(({ blocks, revision, stats }) => {
                return (
                  <RevisionItem
                    key={revision.id}
                    revision={revision}
                    selected={revision.id === selectedKey}
                    restoreDisabled={restoreDisabled}
                    restoring={restoringId === revision.id}
                    stats={stats}
                    onSelect={(revisionId) =>
                      setSelectedKey((key) => (key === revisionId ? '' : revisionId))
                    }
                    onRestore={restoreRevision}
                  >
                    <RevisionDiffViewer blocks={blocks} />
                  </RevisionItem>
                )
              })}
            </div>
          )}
          {!loading && !error && activeTab === 'staged' && hiddenDuplicateCount > 0 && (
            <div className={s.hiddenNote}>
              {hiddenDuplicateCount} {t(REVISION_LABEL_KEY.HIDDEN_DUPLICATES)}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}

export default RevisionDrawer
