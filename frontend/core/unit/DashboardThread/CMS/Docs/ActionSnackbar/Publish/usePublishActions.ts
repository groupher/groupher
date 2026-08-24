import { useCallback } from 'react'

import { ARTICLE_STAGE } from '~/const/article'
import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import { browserQuery } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { send } from '~/lib/signal'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DashboardThread/schema/docs'

import { needsPublishAttention } from '../../Editor/SideTree/helper'
import useDocsEditor from '../../Editor/store/hooks'
import { SAVE_ACTION_LABEL_KEY } from '../constant'
import { PUBLISH_MODE, type TPublishMode } from './constant'
import { getPublishInputAction, hasSelectableChecklistItems } from './helper'
import type { TPublishChangesData, TPublishSelectedInput } from './spec'

const docIdFromChecklistItemId = (id: string): string | null => {
  return id.startsWith('doc:') ? id.slice(4) : null
}

type TArgs = {
  reloadPublishChecklist: () => void
  selectedInput: () => TPublishSelectedInput | undefined
  selectedPublishDisabled: boolean
  onPublished: () => void
}

/** Exposes publish actions state and actions through the shared React hook boundary. */
export default function usePublishActions({
  reloadPublishChecklist,
  selectedInput,
  selectedPublishDisabled,
  onPublished,
}: TArgs) {
  const { t } = useTrans()
  const { slug: community } = useCommunity()
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
        const publishAction =
          mode === PUBLISH_MODE.SELECTED && input ? getPublishInputAction(input) : 'publish'
        const currentDocId = docDraftInfo.id
        const currentDocNeedsPublish =
          publishView.isDirty || needsPublishAttention(docDraftInfo.publishState)
        const publishedDocIds =
          mode === PUBLISH_MODE.SELECTED
            ? (input?.docChangeIds.map(docIdFromChecklistItemId).filter(Boolean) as string[])
            : currentDocId && currentDocNeedsPublish
              ? [currentDocId]
              : []
        const currentDocPublished = currentDocId ? publishedDocIds.includes(currentDocId) : false
        const data = await browserQuery<TPublishChangesData>(S.publishDocChanges, {
          community,
          input,
          mode: 'WITH_COVER_SYNC',
        })
        const nextChecklist = data?.publishDocChanges?.checklist ?? null

        if (nextChecklist) {
          setPublishRuntime?.({
            checklistLoaded: true,
            publishCount: nextChecklist.totalCount,
            hasSelectableChecklistItems: hasSelectableChecklistItems(nextChecklist),
          })
        }
        // Publish may consume the draft row. Keep the current editor document in
        // place and refresh tree/checklist state instead of forcing a draft-only reload.
        if (currentDocPublished) {
          setDocDraftSession?.({
            docDraftInfo: {
              ...docDraftInfo,
              stage: ARTICLE_STAGE.PUBLIC,
              publishState: docDraftInfo.publishState
                ? {
                    ...docDraftInfo.publishState,
                    hasDraft: false,
                    hasUnpublishedChanges: false,
                    published: true,
                    status: ARTICLE_STAGE.PUBLIC,
                  }
                : null,
            },
            saveError: null,
            saveStatus: 'saved',
          })
        }
        if (publishedDocIds.length > 0) {
          send(DSB_DOC_EVENT.PUBLISH_SUCCESS, { docIds: publishedDocIds })
        }
        const successLabel =
          publishAction === 'restore'
            ? SAVE_ACTION_LABEL_KEY.RESTORED
            : publishAction === 'apply'
              ? SAVE_ACTION_LABEL_KEY.APPLIED_CHANGES
              : SAVE_ACTION_LABEL_KEY.PUBLISHED

        toast(t(successLabel))
        reloadSideTree?.()
        reloadPublishChecklist()
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
      onPublished,
      publishView.isDirty,
      publishView.publishDisabled,
      reloadPublishChecklist,
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
