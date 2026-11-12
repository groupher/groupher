import type { TRichEditorValue } from '@groupher/rich-editor'
import { useEffect, useMemo, useState, type FC } from 'react'

import TYPE from '~/const/type'
import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { saveDocQueueCopy, type TSaveDocQueueCopyInput } from '~/lib/artimentPublisher'
import { slugify } from '~/lib/slug'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import useCommunity from '~/stores/community/hooks'
import BaseDrawer from '~/ui/Drawer'
import S from '~/unit/DsbThread/schema/docs'

import Body from '../../Editor/Article/Body'
import { parseEditorValue } from '../../Editor/Article/helper'
import type { TDocWorkingCopy } from '../../Editor/Article/spec'
import { DOC_EDITOR_MODE } from '../../Editor/constant'
import ConfirmDeleteModal from '../../Editor/SideTree/ConfirmDeleteModal'
import useSalon from './salon/queue_editor'

type TProps = {
  articleId: string
  workingCopyId: string
  queueRevision: number
  onClose: () => void
  onSaved: () => void
}

type TDraft = { title: string; subtitle: string; slug: string; body: TRichEditorValue }
const signature = (draft: TDraft): string => JSON.stringify(draft)

const QueueEditorDrawer: FC<TProps> = ({
  articleId,
  workingCopyId,
  queueRevision,
  onClose,
  onSaved,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const [draft, setDraft] = useState<TDraft | null>(null)
  const [baseline, setBaseline] = useState('')
  const [expectedQueueRevision, setExpectedQueueRevision] = useState(queueRevision)
  const [workRevision, setWorkRevision] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const dirty = useMemo(() => !!draft && signature(draft) !== baseline, [draft, baseline])

  useEffect(() => {
    let cancelled = false
    browserGraphQLRequest<{ articleWorkingCopies: TDocWorkingCopy[] }>(S.docsWorkingCopies, {
      community,
      articleId,
    })
      .then((data) => {
        if (cancelled) return
        const copy = data.articleWorkingCopies.find(
          (item) => item.id === workingCopyId && item.scopeKind === 'workspace',
        )
        if (!copy) throw new Error('Queue copy not found')
        const loaded = {
          title: copy.title,
          subtitle: copy.threadFields?.subtitle ?? '',
          slug: copy.slug ?? '',
          body: parseEditorValue(copy.bodyJson),
        }
        setDraft(loaded)
        setBaseline(signature(loaded))
        setWorkRevision(copy.revision)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [articleId, community, workingCopyId])

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
    if (!draft || !workRevision || !dirty || !draft.title.trim() || saving) return
    const started = draft
    setSaving(true)
    setError(null)
    try {
      const slug = started.slug.trim() || (await slugify(started.title.trim()))
      const persisted = {
        ...started,
        title: started.title.trim(),
        subtitle: started.subtitle.trim(),
        slug,
      }
      const result = await executeCommand({
        request: (variables: TSaveDocQueueCopyInput) =>
          saveDocQueueCopy<{ queueRevision: number; workingCopyRevision: number }>(variables),
        variables: {
          value: started.body,
          community,
          articleId,
          title: started.title.trim(),
          subtitle: started.subtitle.trim(),
          slug,
          revision: workRevision,
          queueRevision: expectedQueueRevision,
        },
      })
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
                editorKey={workingCopyId}
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
            disabled={!draft || !dirty || !draft.title.trim() || saving}
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
