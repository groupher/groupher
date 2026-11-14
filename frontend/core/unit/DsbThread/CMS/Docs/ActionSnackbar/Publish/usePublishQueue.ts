import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import { browserGraphQLRequest } from '~/graphql/client'
import type { DocsMergeChoiceInput, DocsMergeField } from '~/graphql/generated/graphql'
import useEvent from '~/hooks/useEvent'
import type {
  DocsQueueApprovalStatus,
  DocsQueueTreeChangeKind,
} from '~/lib/graphql/generated/enums'
import { graphqlQueryOptions } from '~/query'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DsbThread/schema/docs'

import useDocsEditor from '../../Editor/store/hooks'

type TQueue = {
  revision: number
  approvalRequired: boolean
  allowSelfApproval: boolean
  approvalPolicyRevision: number
  approvalStatus: DocsQueueApprovalStatus | null
  articles: { articleId: string; workingCopyId: string; revision: number; title: string }[]
  treeChanges: { nodeId: string; changeKind: DocsQueueTreeChangeKind }[]
}

type TDequeueConfirmation = { formatVersion: number; hash: string }
type TPendingDequeue = {
  articleId: string
  queueRevision: number
  confirmation: TDequeueConfirmation
}
type TMergeConflict = {
  articleId: string
  fields: DocsMergeField[]
  queueRevision: number
  defaultRevision: number
  workingCopyRevision: number
}

/** Reads and mutates the site's complete publication queue. */
export default function usePublishQueue() {
  const { slug: community } = useCommunity()
  const { docDraftInfo, publishView, reloadDocDraft, reloadSideTree, setPublishRuntime } =
    useDocsEditor()
  const [busy, setBusy] = useState(false)
  const [pendingDequeue, setPendingDequeue] = useState<TPendingDequeue | null>(null)
  const [mergeConflict, setMergeConflict] = useState<TMergeConflict | null>(null)
  const dirtyRef = useRef(publishView.isDirty || publishView.isSaving)
  dirtyRef.current = publishView.isDirty || publishView.isSaving
  const { data, error, refetch } = useQuery(
    graphqlQueryOptions<{ docsPublishQueue?: TQueue | null }>(S.docsPublishQueue, { community }),
  )
  const queue = data?.docsPublishQueue ?? null
  const count = queue ? queue.articles.length + queue.treeChanges.length : 0
  const enqueued = queue?.articles.some((article) => article.articleId === docDraftInfo.id) ?? false

  const mergeDefault = useCallback(
    async (choices: DocsMergeChoiceInput[] = []) => {
      const member = queue?.articles.find((article) => article.articleId === docDraftInfo.id)
      if (
        !queue ||
        !member ||
        busy ||
        publishView.isDirty ||
        publishView.isSaving ||
        !docDraftInfo.workingCopyRevision
      )
        return
      const expected = choices.length ? mergeConflict : null
      if (
        choices.length &&
        (!expected ||
          expected.articleId !== member.articleId ||
          expected.queueRevision !== queue.revision ||
          expected.defaultRevision !== docDraftInfo.workingCopyRevision ||
          expected.workingCopyRevision !== member.revision)
      ) {
        setMergeConflict(null)
        await refetch()
        return
      }
      setBusy(true)
      try {
        const data = await executeCommand({
          request: (variables) => browserGraphQLRequest(S.mergeDocsQueueCopy, variables),
          variables: {
            community,
            articleId: member.articleId,
            queueRevision: queue.revision,
            defaultRevision: docDraftInfo.workingCopyRevision,
            workingCopyRevision: member.revision,
            choices,
          },
        })
        const result = data?.mergeDocsQueueCopy
        if (!result) throw new Error('Unable to merge the draft')
        if (result.conflict) setMergeConflict({ articleId: member.articleId, ...result.conflict })
        else {
          setMergeConflict(null)
          await refetch()
        }
      } catch (err) {
        setMergeConflict(null)
        toast(err instanceof Error ? err.message : String(err), 'error')
        await refetch()
      } finally {
        setBusy(false)
      }
    },
    [
      busy,
      community,
      docDraftInfo.id,
      docDraftInfo.workingCopyRevision,
      mergeConflict,
      publishView.isDirty,
      publishView.isSaving,
      queue,
      refetch,
    ],
  )

  useEffect(() => {
    setPublishRuntime?.({
      queueLoaded: queue !== null,
      publishCount: count,
      queueHasItems: count > 0,
      isPublishing: busy,
    })
  }, [busy, count, queue, setPublishRuntime])

  useEvent(
    DSB_DOC_EVENT.PUBLISH_QUEUE_RELOAD,
    () => {
      void refetch()
    },
    [refetch],
  )

  const enqueue = useCallback(async () => {
    if (
      !queue ||
      busy ||
      enqueued ||
      publishView.isDirty ||
      publishView.isSaving ||
      !docDraftInfo.id ||
      !docDraftInfo.workingCopyRevision
    )
      return
    setBusy(true)
    try {
      await executeCommand({
        request: (variables) => browserGraphQLRequest(S.enqueueDocs, variables),
        variables: {
          community,
          queueRevision: queue.revision,
          entries: [
            { articleId: docDraftInfo.id, defaultRevision: docDraftInfo.workingCopyRevision },
          ],
        },
      })
      await refetch()
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
      await refetch()
    } finally {
      setBusy(false)
    }
  }, [
    busy,
    community,
    docDraftInfo.id,
    docDraftInfo.workingCopyRevision,
    enqueued,
    publishView.isDirty,
    publishView.isSaving,
    queue,
    refetch,
  ])

  const release = useCallback(async () => {
    if (
      !queue ||
      !count ||
      busy ||
      publishView.isDirty ||
      publishView.isSaving ||
      (queue.approvalRequired && queue.approvalStatus !== 'APPROVED')
    )
      return
    setBusy(true)
    try {
      await executeCommand({
        request: (variables) => browserGraphQLRequest(S.releaseDocsQueue, variables),
        variables: { community, queueRevision: queue.revision },
      })
      await refetch()
      reloadSideTree?.()
      if (!dirtyRef.current) reloadDocDraft?.()
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
      await refetch()
    } finally {
      setBusy(false)
    }
  }, [
    busy,
    community,
    count,
    publishView.isDirty,
    publishView.isSaving,
    queue,
    refetch,
    reloadDocDraft,
    reloadSideTree,
  ])

  const remove = useCallback(
    async (articleId: string, queueRevision: number, confirmation?: TDequeueConfirmation) => {
      await executeCommand({
        request: (variables) => browserGraphQLRequest(S.dequeueDocs, variables),
        variables: { community, queueRevision, articleIds: [articleId], confirmation },
      })
      setPendingDequeue(null)
      await refetch()
      reloadSideTree?.()
    },
    [community, refetch, reloadSideTree],
  )

  const prepareDequeue = useCallback(
    async (articleId: string) => {
      if (!queue || busy) return
      setBusy(true)
      try {
        const data = await browserGraphQLRequest<{
          docsDequeuePreview?: {
            requiresConfirmation: boolean
            confirmation?: TDequeueConfirmation | null
          } | null
        }>(S.docsDequeuePreview, {
          community,
          queueRevision: queue.revision,
          articleIds: [articleId],
        })
        const preview = data?.docsDequeuePreview
        if (!preview) throw new Error('Unable to check queue edits')
        if (preview.requiresConfirmation) {
          if (!preview.confirmation) throw new Error('Missing discard confirmation')
          setPendingDequeue({
            articleId,
            queueRevision: queue.revision,
            confirmation: preview.confirmation,
          })
        } else {
          await remove(articleId, queue.revision)
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err), 'error')
        await refetch()
      } finally {
        setBusy(false)
      }
    },
    [busy, community, queue, refetch, remove],
  )

  const confirmDequeue = useCallback(async () => {
    if (!pendingDequeue || busy) return
    setBusy(true)
    try {
      await remove(
        pendingDequeue.articleId,
        pendingDequeue.queueRevision,
        pendingDequeue.confirmation,
      )
    } catch (err) {
      setPendingDequeue(null)
      toast(err instanceof Error ? err.message : String(err), 'error')
      await refetch()
    } finally {
      setBusy(false)
    }
  }, [busy, pendingDequeue, refetch, remove])

  return {
    queue,
    count,
    busy,
    enqueued,
    error,
    enqueue,
    mergeDefault,
    mergeConflict,
    cancelMerge: () => setMergeConflict(null),
    release,
    refetch,
    pendingDequeue,
    prepareDequeue,
    confirmDequeue,
    cancelDequeue: () => setPendingDequeue(null),
  }
}

export type TPublishQueueController = ReturnType<typeof usePublishQueue>
