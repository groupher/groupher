import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FC } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import type { DocsMergeField, DocsMergeSide } from '~/graphql/generated/graphql'
import useTrans from '~/hooks/useTrans'
import { graphqlQueryOptions } from '~/query'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DsbThread/schema/docs'

import useDocsEditor from '../Editor/store/hooks'
import useSalon from './Publish/salon/action_group'

/** Resolves a post-publication conflict while preserving unsaved local edits. */
const PostPublishConflict: FC = () => {
  const { t } = useTrans()
  const s = useSalon()
  const { slug: community } = useCommunity()
  const { docDraftInfo, publishView, reloadDocDraft, reloadSideTree, revisionReloadKey } =
    useDocsEditor()
  const [fields, setFields] = useState<DocsMergeField[]>([])
  const [choices, setChoices] = useState<Partial<Record<DocsMergeField, DocsMergeSide>>>({})
  const [busy, setBusy] = useState(false)
  const dirtyRef = useRef(false)
  const activeDocRef = useRef(docDraftInfo.id)
  activeDocRef.current = docDraftInfo.id
  dirtyRef.current = publishView.isDirty || publishView.isSaving
  const query = useQuery({
    ...graphqlQueryOptions<{
      docsPostPublishConflict?: {
        publicSnapshotId: string
        workingCopyId: string
        defaultRevision: number
      } | null
    }>(S.docsPostPublishConflict, { community, articleId: docDraftInfo.id }),
    enabled: !!docDraftInfo.id,
  })
  const conflict = query.data?.docsPostPublishConflict
  useEffect(() => {
    setFields([])
    setChoices({})
    if (docDraftInfo.id) void query.refetch()
  }, [docDraftInfo.id, docDraftInfo.workingCopyRevision, revisionReloadKey, query.refetch])

  const resolve = async (): Promise<void> => {
    if (!conflict || !docDraftInfo.id || dirtyRef.current || busy) return
    if (
      docDraftInfo.workingCopyRevision !== conflict.defaultRevision ||
      docDraftInfo.workingCopyId !== conflict.workingCopyId
    ) {
      setFields([])
      setChoices({})
      await query.refetch()
      return
    }
    setBusy(true)
    const requestArticleId = docDraftInfo.id
    try {
      const data = await executeCommand({
        request: (variables) => browserGraphQLRequest(S.resolveDocsPostPublish, variables),
        variables: {
          community,
          articleId: docDraftInfo.id,
          workingCopyId: conflict.workingCopyId,
          defaultRevision: conflict.defaultRevision,
          publicSnapshotId: conflict.publicSnapshotId,
          choices: fields.map((field) => ({ field, side: choices[field]! })),
        },
      })
      const result = data?.resolveDocsPostPublish
      if (activeDocRef.current !== requestArticleId) return
      if (!result) throw new Error('Unable to resolve publication conflict')
      if (result.conflictFields?.length) {
        setFields(result.conflictFields)
        setChoices({})
      } else if ('workingCopyRevision' in result) {
        setFields([])
        setChoices({})
        await query.refetch()
        reloadSideTree?.()
        if (!dirtyRef.current) reloadDocDraft?.()
        else toast(t('dsb.doc.queue.conflict_preserve_local'), 'info')
      } else throw new Error('Unable to resolve publication conflict')
    } catch (err) {
      if (activeDocRef.current !== requestArticleId) return
      toast(err instanceof Error ? err.message : String(err), 'error')
      setFields([])
      setChoices({})
      await query.refetch()
    } finally {
      setBusy(false)
    }
  }

  if (!conflict) return null
  return (
    <div role='alert'>
      <span>{t('dsb.doc.queue.post_conflict')}</span>
      {fields.map((field) => (
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
            <option value='SOURCE'>{t('dsb.doc.queue.conflict_public')}</option>
            <option value='TARGET'>{t('dsb.doc.queue.conflict_draft')}</option>
          </select>
        </label>
      ))}
      <button
        type='button'
        className={s.reviewButton}
        disabled={busy || dirtyRef.current || fields.some((field) => !choices[field])}
        onClick={() => void resolve()}
      >
        {t(fields.length ? 'dsb.doc.queue.merge_confirm' : 'dsb.doc.queue.conflict_resolve')}
      </button>
    </div>
  )
}

export default PostPublishConflict
