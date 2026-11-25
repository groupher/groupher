import type { TRichEditorValue } from '@groupher/rich-editor'
import { useEffect, useMemo, useRef, useState, type FC } from 'react'

import TYPE from '~/const/type'
import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { saveDocQueueCopy, type TSaveDocQueueCopyInput } from '~/lib/artimentPublisher'
import { ContentPublishError } from '~/lib/contentPublisher'
import { slugify } from '~/lib/slug'
import { createCommandHandle, executeCommand } from '~/query/mutation/optimistic/execute'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import BaseDrawer from '~/ui/Drawer'
import { queueMemberEditor } from '~/unit/DocThread/schema'

import Body from '../../Editor/Article/Body'
import { parseEditorValue } from '../../Editor/Article/helper'
import type { TDocWorkingCopy } from '../../Editor/Article/spec'
import { DOC_EDITOR_MODE } from '../../Editor/constant'
import ConfirmDeleteModal from '../../Editor/SideTree/ConfirmDeleteModal'
import useSalon from './salon/queue_editor'

type TProps = {
  articleId: string
  onClose: () => void
  onSaved: () => void
}

type TDraft = { title: string; subtitle: string; slug: string; body: TRichEditorValue }
const signature = (draft: TDraft): string => JSON.stringify(draft)

const QueueEditorDrawer: FC<TProps> = ({ articleId, onClose, onSaved }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { accountScope } = useAccount()
  const { slug: community } = useCommunity()
  const pendingSaveRef = useRef<{
    started: TDraft
    unknown: boolean
    persisted: TDraft
    variables: TSaveDocQueueCopyInput
  } | null>(null)
  const [draft, setDraft] = useState<TDraft | null>(null)
  const [baseline, setBaseline] = useState('')
  const [expectedQueueRevision, setExpectedQueueRevision] = useState<number | null>(null)
  const [workingCopyId, setWorkingCopyId] = useState<string | null>(null)
  const [workRevision, setWorkRevision] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [recoveryBlocked, setRecoveryBlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const dirty = useMemo(() => !!draft && signature(draft) !== baseline, [draft, baseline])

  useEffect(() => {
    let cancelled = false
    pendingSaveRef.current = null
    setDraft(null)
    setBaseline('')
    setWorkingCopyId(null)
    setWorkRevision(null)
    setExpectedQueueRevision(null)
    setError(null)
    setRecoveryBlocked(false)
    if (!accountScope) return
    browserGraphQLRequest<{
      docsQueueMember: {
        queueRevision: number
        workingCopy: TDocWorkingCopy
      } | null
    }>(queueMemberEditor, {
      community,
      articleId,
    })
      .then((data) => {
        if (cancelled) return
        const member = data.docsQueueMember
        if (!member || member.workingCopy.scopeType !== 'workspace')
          throw new Error('Queue copy not found')
        const copy = member.workingCopy
        const loaded = {
          title: copy.title,
          subtitle: copy.threadFields?.subtitle ?? '',
          slug: copy.slug ?? '',
          body: parseEditorValue(copy.bodyJson),
        }
        setDraft(loaded)
        setBaseline(signature(loaded))
        setWorkingCopyId(copy.id)
        setWorkRevision(copy.revision)
        setExpectedQueueRevision(member.queueRevision)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [accountScope, articleId, community])

  useEffect(() => {
    if (!dirty) return
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  }, [dirty])

  const requestClose = (): void => {
    if (saving) return
    if (dirty) setConfirmClose(true)
    else onClose()
  }

  const save = async (): Promise<void> => {
    if (
      !draft ||
      !workRevision ||
      expectedQueueRevision === null ||
      !dirty ||
      !draft.title.trim() ||
      saving ||
      recoveryBlocked
    )
      return
    setSaving(true)
    setError(null)
    try {
      if (!pendingSaveRef.current) {
        const started = draft
        const slug = started.slug.trim() || (await slugify(started.title.trim()))
        const persisted = {
          ...started,
          title: started.title.trim(),
          subtitle: started.subtitle.trim(),
          slug,
        }
        pendingSaveRef.current = {
          started,
          unknown: false,
          persisted,
          variables: {
            value: started.body,
            community,
            articleId,
            title: persisted.title,
            subtitle: persisted.subtitle,
            slug,
            revision: workRevision,
            queueRevision: expectedQueueRevision,
            commandId: createCommandHandle({ articleId }).commandId,
          },
        }
      }
      const { started, persisted, variables } = pendingSaveRef.current
      const result = await executeCommand({
        request: (input: TSaveDocQueueCopyInput) =>
          saveDocQueueCopy<{ queueRevision: number; workingCopyRevision: number }>(input),
        variables,
        commandId: variables.commandId,
      })
      pendingSaveRef.current = null
      setExpectedQueueRevision(result.queueRevision)
      setWorkRevision(result.workingCopyRevision)
      setBaseline(signature(persisted))
      setDraft(
        (current) =>
          current && {
            ...current,
            title: current.title === started.title ? persisted.title : current.title,
            subtitle: current.subtitle === started.subtitle ? persisted.subtitle : current.subtitle,
            slug: current.slug === started.slug ? persisted.slug : current.slug,
          },
      )
      onSaved()
    } catch (err) {
      if (err instanceof ContentPublishError && err.code === 'transport_unknown') {
        if (pendingSaveRef.current) pendingSaveRef.current.unknown = true
      } else if (
        !(err instanceof ContentPublishError) ||
        !pendingSaveRef.current?.unknown ||
        ![401, 403, 429].includes(err.status)
      ) {
        pendingSaveRef.current = null
      }
      if (
        err instanceof ContentPublishError &&
        [
          'docs_queue_version_conflict',
          'docs_queue_copy_revision_conflict',
          'revision_conflict',
          'command_result_unavailable',
          'command_result_expired',
        ].includes(err.code)
      ) {
        setRecoveryBlocked(true)
        try {
          const data = await browserGraphQLRequest<{
            docsQueueMember: { queueRevision: number; workingCopy: TDocWorkingCopy } | null
          }>(queueMemberEditor, { community, articleId })
          const member = data.docsQueueMember
          const copy = member?.workingCopy
          const serverDraft = copy && {
            title: copy.title,
            subtitle: copy.threadFields?.subtitle ?? '',
            slug: copy.slug ?? '',
            body: parseEditorValue(copy.bodyJson),
          }
          if (copy?.id === workingCopyId && serverDraft && signature(serverDraft) === baseline) {
            setExpectedQueueRevision(member.queueRevision)
            setWorkRevision(copy.revision)
            setRecoveryBlocked(false)
            setError('The queue changed. Your local edits are preserved; review and save again.')
          } else {
            setError('The queue copy changed or was removed. Your local edits are preserved.')
          }
        } catch {
          setError('The queue could not be reloaded. Your local edits are preserved.')
        }
        return
      }
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BaseDrawer show onClose={requestClose} type={TYPE.DRAWER.DOC_PUBLISH} wide>
      <ConfirmDeleteModal
        message={confirmClose ? t('dsb.doc.queue.editor_discard') : null}
        confirmLabel={t('dsb.doc.queue.editor_discard_confirm')}
        onCancel={() => setConfirmClose(false)}
        onConfirm={onClose}
      />
      <div className={s.wrapper}>
        <div className={s.header}>
          <div className={s.title}>{t('dsb.doc.queue.editor_title')}</div>
          <button
            type='button'
            className={s.close}
            onClick={requestClose}
            aria-label={t('dsb.doc.queue.close')}
          >
            ×
          </button>
        </div>
        <div className={s.body}>
          {draft && (
            <>
              <input
                className={s.input}
                aria-label={t('dsb.doc.queue.editor_title_field')}
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
              <input
                className={s.input}
                aria-label={t('dsb.doc.queue.editor_subtitle_field')}
                value={draft.subtitle}
                onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })}
              />
              <input
                className={s.input}
                aria-label={t('dsb.doc.queue.editor_slug_field')}
                value={draft.slug}
                onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
              />
              <Body
                editorKey={workingCopyId ?? articleId}
                value={draft.body}
                mode={DOC_EDITOR_MODE.EDIT}
                onChange={(body) =>
                  setDraft((current) => (current ? { ...current, body } : current))
                }
              />
            </>
          )}
          {error && (
            <div className={s.error} role='alert'>
              {error}
            </div>
          )}
        </div>
        <div className={s.footer}>
          <button
            type='button'
            className={s.save}
            disabled={!draft || !dirty || !draft.title.trim() || saving || recoveryBlocked}
            onClick={() => void save()}
          >
            {t('dsb.doc.queue.editor_save')}
          </button>
        </div>
      </div>
    </BaseDrawer>
  )
}

export default QueueEditorDrawer
