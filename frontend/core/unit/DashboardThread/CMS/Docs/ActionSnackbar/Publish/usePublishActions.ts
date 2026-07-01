import { useCallback } from 'react'

import { DOC_STAGE, DSB_DOC_EVENT } from '~/const/dsb/docs'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import { send } from '~/lib/signal'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'
import { toast } from '~/widgets/Toaster'

import { needsPublishAttention } from '../../Editor/SideTree/helper'
import useDocsEditor from '../../Editor/store/hooks'
import { SAVE_ACTION_LABEL_KEY } from '../constant'
import { PUBLISH_MODE, type TPublishMode } from './constant'
import { hasSelectableScopeItems } from './helper'
import type { TPublishChangesData, TPublishSelectedInput } from './spec'

const docIdFromScopeItemId = (id: string): string | null => {
  return id.startsWith('doc:') ? id.slice(4) : null
}

type TArgs = {
  reloadPublishScope: () => void
  selectedInput: () => TPublishSelectedInput | undefined
  selectedPublishDisabled: boolean
  onPublished: () => void
}

export default function usePublishActions({
  reloadPublishScope,
  selectedInput,
  selectedPublishDisabled,
  onPublished,
}: TArgs) {
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()
  const {
    docDraftInfo,
    publishView,
    reloadSideTree,
    saveDocDraft,
    setDocDraftSession,
    setPublishRuntime,
  } = useDocsEditor()

  const publishDraft = useCallback(
    async (mode: TPublishMode = PUBLISH_MODE.ALL) => {
      const disabled =
        mode === PUBLISH_MODE.SELECTED ? selectedPublishDisabled : publishView.publishDisabled
      if (disabled) return

      setPublishRuntime?.({ isPublishing: true })

      try {
        if (publishView.isDirty) await saveDocDraft()
        const input = mode === PUBLISH_MODE.SELECTED ? selectedInput() : undefined
        const currentDocId = docDraftInfo.id
        const currentDocNeedsPublish =
          publishView.isDirty || needsPublishAttention(docDraftInfo.publishState)
        const publishedDocIds =
          mode === PUBLISH_MODE.SELECTED
            ? (input?.docChangeIds.map(docIdFromScopeItemId).filter(Boolean) as string[])
            : currentDocId && currentDocNeedsPublish
              ? [currentDocId]
              : []
        const data = await mutate<TPublishChangesData>(S.publishDocChanges, {
          community,
          input,
          mode: 'WITH_COVER_SYNC',
        })
        const nextScope = data?.publishDocChanges?.scope ?? null

        if (nextScope) {
          setPublishRuntime?.({
            scopeLoaded: true,
            publishCount: nextScope.totalCount,
            hasSelectableScopeItems: hasSelectableScopeItems(nextScope),
          })
        }
        // Publish may consume the draft row. Keep the current editor document in
        // place and refresh tree/scope state instead of forcing a draft-only reload.
        setDocDraftSession?.({
          docDraftInfo: {
            ...docDraftInfo,
            stage: DOC_STAGE.PUBLIC,
            publishState: docDraftInfo.publishState
              ? {
                  ...docDraftInfo.publishState,
                  hasDraft: false,
                  hasUnpublishedChanges: false,
                  published: true,
                  status: DOC_STAGE.PUBLIC,
                }
              : null,
          },
          saveError: null,
          saveStatus: 'saved',
        })
        if (publishedDocIds.length > 0) {
          send(DSB_DOC_EVENT.PUBLISH_SUCCESS, { docIds: publishedDocIds })
        }
        toast(t(SAVE_ACTION_LABEL_KEY.PUBLISHED))
        reloadSideTree?.()
        reloadPublishScope()
        onPublished()
      } catch (err) {
        const message = err instanceof Error ? err.message : t(SAVE_ACTION_LABEL_KEY.PUBLISH_FAILED)
        toast(message, 'error')
      } finally {
        setPublishRuntime?.({ isPublishing: false })
      }
    },
    [
      community,
      docDraftInfo,
      mutate,
      onPublished,
      publishView.isDirty,
      publishView.publishDisabled,
      reloadPublishScope,
      reloadSideTree,
      saveDocDraft,
      selectedInput,
      selectedPublishDisabled,
      setDocDraftSession,
      setPublishRuntime,
      t,
    ],
  )

  return { publishDraft }
}
