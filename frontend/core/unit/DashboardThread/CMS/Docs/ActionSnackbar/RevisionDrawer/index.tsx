import { type FC, useCallback, useEffect, useMemo, useState } from 'react'

import TYPE from '~/const/type'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import CloseLightSVG from '~/icons/CloseLight'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'
import Drawer from '~/widgets/Drawer'
import { SegmentTab } from '~/widgets/Switcher'
import { toast } from '~/widgets/Toaster'

import useDocsEditor from '../../Editor/store/hooks'
import { DOC_REVISION_RELOAD_EVENT, REVISION_LABEL_KEY } from '../constant'
import { buildRevisionDiffModel, hasRevisionDiffStats } from './helper'
import RevisionDiffViewer from './RevisionDiffViewer'
import RevisionItem from './RevisionItem'
import useSalon, { cn } from './salon'
import type { TArticleSnapshot, TDocDraftSnapshotsPayload } from './spec'

type TProps = {
  show: boolean
  onClose: () => void
}

type TRevisionTab = 'staged' | 'published'

const CURRENT_CHANGES_KEY = 'current'

const REVISION_TABS = [
  { labelKey: REVISION_LABEL_KEY.STAGED_TAB, key: 'staged' },
  { labelKey: REVISION_LABEL_KEY.PUBLISHED_TAB, key: 'published' },
] as const

const RevisionDrawer: FC<TProps> = ({ show, onClose }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { query, mutate } = useGraphQLClient()
  const { baselineValue, bodyValue, docDraftInfo, reloadDocDraft, saveStatus } = useDocsEditor()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftRevisions, setDraftRevisions] = useState<TArticleSnapshot[]>([])
  const [publishedRevisions, setPublishedRevisions] = useState<TArticleSnapshot[]>([])
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
        query<TDocDraftSnapshotsPayload>(S.docDraftSnapshots, {
          community,
          id: docDraftId,
          stage: 'DRAFT',
        }),
        query<TDocDraftSnapshotsPayload>(S.docDraftSnapshots, {
          community,
          id: docDraftId,
          stage: 'PUBLIC',
        }),
      ])

      const nextDraftRevisions = draftData?.docDraftSnapshots || []
      const nextPublishedRevisions = publishedData?.docDraftSnapshots || []
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
    if (!show) return

    const reload = (): void => {
      void loadRevisions()
    }

    window.addEventListener(DOC_REVISION_RELOAD_EVENT, reload)
    return () => window.removeEventListener(DOC_REVISION_RELOAD_EVENT, reload)
  }, [loadRevisions, show])

  useEffect(() => {
    setSelectedKey(activeTab === 'staged' ? CURRENT_CHANGES_KEY : '')
  }, [activeTab])

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
  const revisionDiffModel = useMemo(
    () =>
      buildRevisionDiffModel({
        baselineValue,
        bodyValue,
        draftRevisions,
        publishedRevisions,
      }),
    [baselineValue, bodyValue, draftRevisions, publishedRevisions],
  )
  const activeRevisionEntries =
    activeTab === 'staged' ? revisionDiffModel.stagedEntries : revisionDiffModel.publishedEntries
  const hasCurrentDiff = activeTab === 'staged' && revisionDiffModel.hasCurrentDiff
  const hasVisibleDiff = activeRevisionEntries.length > 0 || hasCurrentDiff

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
              onChange={(key) => setActiveTab(key as TRevisionTab)}
            />
          </div>

          {activeTab === 'staged' && hasCurrentDiff && (
            <div
              className={cn(
                s.currentChangesCard,
                selectedKey === CURRENT_CHANGES_KEY && s.currentChangesCardActive,
              )}
            >
              <button
                type='button'
                className={s.currentChangesButton}
                onClick={() => {
                  setSelectedKey((key) => (key === CURRENT_CHANGES_KEY ? '' : CURRENT_CHANGES_KEY))
                }}
              >
                <span className={s.currentChangesSummary}>
                  <span>Now</span>
                  <span className={s.additions}>+{revisionDiffModel.currentStats.additions}</span>
                  <span className={s.deletions}>-{revisionDiffModel.currentStats.deletions}</span>
                </span>
              </button>

              {selectedKey === CURRENT_CHANGES_KEY &&
                hasRevisionDiffStats(revisionDiffModel.currentStats) && (
                  <div className={s.inlineDiff}>
                    <RevisionDiffViewer blocks={revisionDiffModel.currentBlocks} />
                  </div>
                )}
            </div>
          )}

          {restoreDisabled && (
            <div className={s.restoreHint}>{t(REVISION_LABEL_KEY.SAVE_BEFORE_RESTORE)}</div>
          )}

          {loading && <div className={s.stateBox}>{t(REVISION_LABEL_KEY.LOADING)}</div>}
          {!loading && error && (
            <div className={s.errorBox}>{t(REVISION_LABEL_KEY.LOAD_FAILED)}</div>
          )}
          {!loading && !error && !hasVisibleDiff && (
            <div className={s.stateBox}>{t(REVISION_LABEL_KEY.EMPTY)}</div>
          )}
          {!loading && !error && activeRevisionEntries.length > 0 && (
            <div className={s.list}>
              {activeRevisionEntries.map(({ blocks, revision, stats }) => {
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
