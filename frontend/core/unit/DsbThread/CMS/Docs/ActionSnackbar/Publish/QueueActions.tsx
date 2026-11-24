import { lazy, Suspense, useState, type FC } from 'react'

import TYPE from '~/const/type'
import type { DocsMergeField, DocsMergeSide } from '~/graphql/generated/graphql'
import useTrans from '~/hooks/useTrans'
import BaseDrawer from '~/ui/Drawer'

import useDocsEditor from '../../Editor/store/hooks'
import QueueEditorDrawer from './QueueEditorDrawer'
import useActionSalon from './salon/action_group'
import useDrawerSalon from './salon/drawer'
import type { TPublishQueueController } from './usePublishQueue'

const Publication = lazy(() => import('../Publication'))

type TProps = { queue: TPublishQueueController }

const APPROVAL_LABELS = {
  IDLE: 'dsb.doc.queue.approval_idle',
  PENDING: 'dsb.doc.queue.approval_pending',
  APPROVED: 'dsb.doc.queue.approval_approved',
  NEEDS_REAPPROVAL: 'dsb.doc.queue.approval_needs_reapproval',
} as const

const QueueActions: FC<TProps> = ({ queue }) => {
  const { t } = useTrans()
  const action = useActionSalon()
  const drawer = useDrawerSalon()
  const { docDraftInfo, publishView } = useDocsEditor()
  const [show, setShow] = useState(false)
  const [publication, setPublication] = useState(false)
  const [editing, setEditing] = useState<{ articleId: string } | null>(null)
  const [choices, setChoices] = useState<Partial<Record<DocsMergeField, DocsMergeSide>>>({})
  const blocked = queue.busy || publishView.isDirty || publishView.isSaving || !!queue.error
  const close = () => {
    queue.cancelDequeue()
    queue.cancelMerge()
    setChoices({})
    setShow(false)
  }

  return (
    <>
      {publication && (
        <Suspense fallback={null}>
          <Publication queue={queue} onClose={() => setPublication(false)} />
        </Suspense>
      )}
      <div className={action.treeGroup}>
        <button type='button' className={action.reviewButton} onClick={() => setPublication(true)}>
          {t('dsb.doc.publication.open_workspace')}
        </button>
        {queue.error && <span>{t('dsb.doc.queue.unavailable')}</span>}
        {docDraftInfo.id && (
          <button
            type='button'
            className={action.reviewButton}
            title={queue.enqueued ? t('dsb.doc.queue.separate_draft') : undefined}
            disabled={
              blocked || !queue.queue || queue.enqueued || !docDraftInfo.workingCopyRevision
            }
            onClick={() => void queue.enqueue()}
          >
            {t(queue.enqueued ? 'dsb.doc.queue.enqueued' : 'dsb.doc.queue.enqueue')}
          </button>
        )}
        {queue.enqueued && (
          <button
            type='button'
            className={action.reviewButton}
            disabled={blocked}
            onClick={() => {
              setChoices({})
              setShow(true)
              void queue.mergeDefault()
            }}
          >
            {t('dsb.doc.queue.merge')}
          </button>
        )}
        <button
          type='button'
          className={action.reviewButton}
          disabled={!queue.queue}
          onClick={() => setShow(true)}
        >
          {t('dsb.doc.queue.review')} ({queue.count})
        </button>
        <button
          type='button'
          className={action.treePublishButton}
          disabled={
            blocked ||
            !queue.count ||
            (!!queue.queue?.approvalRequired && queue.queue.approvalStatus !== 'APPROVED')
          }
          onClick={() => void queue.release()}
        >
          {t('dsb.doc.queue.release')}
        </button>
      </div>
      <BaseDrawer show={show && !editing} onClose={close} type={TYPE.DRAWER.DOC_PUBLISH}>
        <div className={drawer.drawer}>
          <div className={drawer.header}>
            <div className={drawer.title}>{t('dsb.doc.queue.review')}</div>
            <button
              type='button'
              className={drawer.closeButton}
              onClick={close}
              aria-label={t('dsb.doc.queue.close')}
            >
              ×
            </button>
          </div>
          <div className={drawer.body}>
            <div className={drawer.menu}>
              {queue.queue?.approvalRequired && (
                <div>
                  {t('dsb.doc.queue.approval_status')}:{' '}
                  {t(APPROVAL_LABELS[queue.queue.approvalStatus ?? 'PENDING'])}
                </div>
              )}
              {queue.mergeConflict && (
                <div role='alert'>
                  <p>{t('dsb.doc.queue.merge_conflict')}</p>
                  {queue.mergeConflict.fields.map((field) => (
                    <label key={field}>
                      {field}
                      <select
                        value={choices[field] ?? ''}
                        onChange={(event) =>
                          setChoices((current) => ({
                            ...current,
                            [field]: event.target.value as DocsMergeSide,
                          }))
                        }
                      >
                        <option value=''>{t('dsb.doc.queue.merge_choose')}</option>
                        <option value='SOURCE'>{t('dsb.doc.queue.merge_draft')}</option>
                        <option value='TARGET'>{t('dsb.doc.queue.merge_queued')}</option>
                      </select>
                    </label>
                  ))}
                  <button type='button' className={action.reviewButton} onClick={queue.cancelMerge}>
                    {t('dsb.doc.queue.cancel')}
                  </button>
                  <button
                    type='button'
                    className={action.treePublishButton}
                    disabled={
                      blocked || queue.mergeConflict.fields.some((field) => !choices[field])
                    }
                    onClick={() =>
                      void queue.mergeDefault(
                        queue.mergeConflict!.fields.map((field) => ({
                          field,
                          side: choices[field]!,
                        })),
                      )
                    }
                  >
                    {t('dsb.doc.queue.merge_confirm')}
                  </button>
                </div>
              )}
              {queue.queue?.articles.map((article) => (
                <div key={article.articleId} className={action.treeGroup}>
                  <span>{article.title}</span>
                  <button
                    type='button'
                    className={action.reviewButton}
                    disabled={queue.busy}
                    onClick={() =>
                      setEditing({
                        articleId: article.articleId,
                      })
                    }
                  >
                    {t('dsb.doc.queue.editor_open')}
                  </button>
                  <button
                    type='button'
                    className={action.reviewButton}
                    disabled={queue.busy}
                    onClick={() => void queue.prepareDequeue(article.articleId)}
                  >
                    {t('dsb.doc.queue.remove')}
                  </button>
                </div>
              ))}
              {!!queue.queue?.treeChanges.length && (
                <div>
                  {t('dsb.doc.queue.tree_changes')}: {queue.queue.treeChanges.length}
                </div>
              )}
              {queue.pendingDequeue && (
                <div role='alert'>
                  <p>{t('dsb.doc.queue.discard_warning')}</p>
                  <button
                    type='button'
                    className={action.reviewButton}
                    disabled={queue.busy}
                    onClick={queue.cancelDequeue}
                  >
                    {t('dsb.doc.queue.cancel')}
                  </button>
                  <button
                    type='button'
                    className={action.treePublishButton}
                    disabled={queue.busy}
                    onClick={() => void queue.confirmDequeue()}
                  >
                    {t('dsb.doc.queue.confirm_remove')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </BaseDrawer>
      {editing && (
        <QueueEditorDrawer
          {...editing}
          onClose={() => setEditing(null)}
          onSaved={() => void queue.refetch()}
        />
      )}
    </>
  )
}

export default QueueActions
