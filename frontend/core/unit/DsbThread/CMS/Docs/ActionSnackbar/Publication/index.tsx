import { useEffect, useLayoutEffect, useRef, useState, type FC } from 'react'

import TYPE from '~/const/type'
import useTrans from '~/hooks/useTrans'
import useCommunity from '~/stores/community/hooks'
import BaseDrawer from '~/ui/Drawer'

import useDocsEditor from '../../Editor/store/hooks'
import type { TPublishQueueController } from '../Publish/usePublishQueue'
import DiffPane from './DiffPane'
import HistoryPane from './HistoryPane'
import Notices from './Notices'
import PreviewPane from './PreviewPane'
import useSalon from './salon'
import SettingsPane from './SettingsPane'
import type { Comparison, Preview, ReleasePage, SnapshotPage, Policy } from './types'
import usePublication, { type Tab, type Detail } from './usePublication'

const Publication: FC<{ queue: TPublishQueueController; onClose: () => void }> = ({
  queue,
  onClose,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { docDraftInfo, publishView, reloadDocDraft, reloadSideTree } = useDocsEditor()
  const dirty = useRef(publishView.isDirty)
  useLayoutEffect(() => {
    dirty.current = publishView.isDirty
  }, [publishView.isDirty])
  const [restoreReady, setRestoreReady] = useState(false)
  const [tab, setTab] = useState<Tab>('preview')
  const [baseline, setBaseline] = useState<'PUBLIC' | 'APPROVAL'>('APPROVAL')
  const [snapshotMode, setSnapshotMode] = useState(false)
  const view = usePublication(community)
  const { read, cancel } = view
  useEffect(() => {
    void read('preview', { refresh: true })
    return cancel
  }, [read, cancel])
  const switchTab = (next: Tab) => {
    cancel()
    setTab(next)
    setSnapshotMode(false)
    setRestoreReady(false)
    void read(next, { baseline, refresh: true })
  }
  const select = (articleId: string) => void read(tab, { articleId, baseline })
  const refresh = () =>
    void read(tab, {
      baseline,
      refresh: true,
      articleId: snapshotMode ? docDraftInfo.id : undefined,
    })
  return (
    <BaseDrawer show onClose={onClose} type={TYPE.DRAWER.DOC_PUBLISH}>
      <div className={s.wrapper}>
        <header className={s.header}>
          {(['preview', 'diff', 'history', 'settings'] as const).map((name) => (
            <button
              type='button'
              className={tab === name ? s.active : s.button}
              key={name}
              onClick={() => switchTab(name)}
            >
              {t(`dsb.doc.publication.${name}`)}
            </button>
          ))}
          <button type='button' className={s.button} onClick={onClose}>
            {t('dsb.doc.queue.close')}
          </button>
        </header>
        <div className={s.body}>
          {view.error && <p role='alert'>{t(view.error as 'dsb.doc.publication.action_failed')}</p>}
          {view.busy && <p role='status'>{t('dsb.doc.publication.loading')}</p>}
          {
            <button type='button' className={s.button} disabled={view.busy} onClick={refresh}>
              {t('dsb.doc.publication.refresh')}
            </button>
          }
          {tab === 'preview' && view.data && (
            <PreviewPane data={view.data as Preview} onSelect={select} />
          )}
          {tab === 'diff' && (
            <>
              <label>
                {t('dsb.doc.publication.compare')}{' '}
                <select
                  value={baseline}
                  onChange={(e) => {
                    const next = e.target.value as 'PUBLIC' | 'APPROVAL'
                    setBaseline(next)
                    void read('diff', { baseline: next, refresh: true })
                  }}
                >
                  <option value='APPROVAL'>{t('dsb.doc.publication.approved_baseline')}</option>
                  <option value='PUBLIC'>{t('dsb.doc.publication.public_baseline')}</option>
                </select>
              </label>
              {view.data && <DiffPane data={view.data as Comparison} onSelect={select} />}
              {queue.queue?.approvalRequired && (
                <button
                  type='button'
                  className={s.button}
                  disabled={view.busy || !view.data || publishView.isDirty || publishView.isSaving}
                  onClick={async () => {
                    if (
                      await view.mutate('approve', {
                        queueRevision: (view.data as Comparison).versions.queue_revision,
                      })
                    ) {
                      await queue.refetch()
                      refresh()
                    }
                  }}
                >
                  {t('dsb.doc.publication.approve')}
                </button>
              )}
            </>
          )}
          {tab === 'history' && (
            <>
              <div className={s.row}>
                <button
                  type='button'
                  className={s.button}
                  onClick={() => {
                    setSnapshotMode(false)
                    void read('history')
                  }}
                >
                  {t('dsb.doc.publication.releases')}
                </button>
                <button
                  type='button'
                  className={s.button}
                  disabled={!docDraftInfo.id}
                  onClick={() => {
                    setSnapshotMode(true)
                    void read('history', { articleId: docDraftInfo.id })
                  }}
                >
                  {t('dsb.doc.publication.snapshots')}
                </button>
              </div>
              {view.data && (
                <HistoryPane
                  data={view.data as ReleasePage | SnapshotPage | Detail}
                  onRelease={(releaseId, articleId) =>
                    void read('history', { releaseId, articleId })
                  }
                  onSnapshot={(snapshotId) => {
                    setRestoreReady(false)
                    void read('history', { articleId: docDraftInfo.id, snapshotId })
                  }}
                  onNext={(beforeId, cursor) =>
                    void read('history', {
                      beforeId,
                      cursor,
                      articleId: snapshotMode ? docDraftInfo.id : undefined,
                    })
                  }
                />
              )}
            </>
          )}
          {tab === 'history' &&
            snapshotMode &&
            view.data &&
            'page' in view.data &&
            view.data.page && (
              <div className={s.panel}>
                <p>{t('dsb.doc.publication.restore_hint')}</p>
                <button
                  className={s.button}
                  type='button'
                  disabled={view.busy || publishView.isDirty || publishView.isSaving}
                  onClick={async () => {
                    if (!restoreReady) {
                      setRestoreReady(true)
                      return
                    }
                    const snapshotId = (view.data as SnapshotPage).page!.id
                    if (
                      await view.mutate('restore', {
                        articleId: docDraftInfo.id,
                        snapshotId,
                        workingCopyId: docDraftInfo.workingCopyId ?? null,
                        revision: docDraftInfo.workingCopyRevision ?? null,
                      })
                    ) {
                      reloadSideTree?.()
                      if (!dirty.current) reloadDocDraft?.()
                      setRestoreReady(false)
                      refresh()
                    }
                  }}
                >
                  {t(
                    restoreReady
                      ? 'dsb.doc.publication.confirm_restore'
                      : 'dsb.doc.publication.restore',
                  )}
                </button>
              </div>
            )}
          {tab === 'settings' && view.data && (
            <SettingsPane
              key={(view.data as Policy).approval_policy_revision}
              required={(view.data as Policy).approval_required}
              selfApproval={(view.data as Policy).allow_self_approval}
              busy={view.busy}
              onSave={async (approvalRequired, allowSelfApproval) => {
                if (
                  await view.mutate('configure', {
                    approvalPolicyRevision: (view.data as Policy).approval_policy_revision,
                    approvalRequired,
                    allowSelfApproval,
                  })
                ) {
                  await queue.refetch()
                  refresh()
                }
              }}
            />
          )}
          <Notices community={community} />
        </div>
      </div>
    </BaseDrawer>
  )
}
export default Publication
