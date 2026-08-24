import { useQueryClient } from '@tanstack/react-query'
import { prop, uniqBy } from 'ramda'
import { useContext } from 'react'

import useViewingArticle from '~/hooks/useViewingArticle'
import { commentKeys } from '~/query'
import type { TComment, TID } from '~/spec'
import { StoreContext as CommentsStoreContext } from '~/stores/comments/context'
import type { TStore as TCommentsStore } from '~/stores/comments/spec'

import { EDIT_MODE, MODE } from '../constant'
import type { TEditMode } from '../spec'

type TRet = {
  addToReplies: (parentId: TID, replies: TComment[]) => void
  published: () => void
  resetPublish: (mode: TEditMode) => void
}

/** Exposes helper state and actions through the shared React hook boundary. */
export default function useHelper(): TRet {
  const commentsStore = useContext(CommentsStoreContext) as TCommentsStore | null
  if (!commentsStore) {
    throw new Error('useHelper must be used within a Comments store provider')
  }
  const comments = commentsStore
  const queryClient = useQueryClient()
  const { article } = useViewingArticle()
  const commentScope = {
    community: article.community.slug,
    thread: article.meta.thread,
    articleInnerId: article.innerId,
  }
  const patchComments = (updater: (entries: TComment[]) => TComment[]) => {
    queryClient.setQueriesData(
      {
        predicate: (query) =>
          commentKeys.matchesArticle(
            query,
            commentScope.community,
            commentScope.thread,
            commentScope.articleInnerId,
          ),
      },
      (data: { entries?: TComment[] } | undefined) =>
        data?.entries ? { ...data, entries: updater(data.entries) } : data,
    )
  }

  const addToReplies = (parentId: TID, replies: TComment[]): void => {
    if (comments.mode !== MODE.REPLIES || !parentId) return
    patchComments((entries) =>
      entries.map((item) => {
        if (item.innerId !== parentId) return item
        const uniqReplies = uniqBy(prop('innerId'), [
          ...(item.replies || []),
          ...replies,
        ]) as TComment[]
        return { ...item, replies: uniqReplies }
      }),
    )
  }

  const published = (): void => {
    commentsStore.commit({ publishing: false, publishDone: true })
  }

  const resetPublish = (mode: TEditMode): void => {
    switch (mode) {
      case EDIT_MODE.REPLY: {
        commentsStore.commit({
          showReplyEditor: false,
          replyBody: '{}',
          replyToComment: null,
          publishDone: false,
        })
        return
      }
      case EDIT_MODE.UPDATE: {
        commentsStore.commit({
          showUpdateEditor: false,
          updateInnerId: null,
          updateBody: '{}',
          publishDone: false,
        })
        return
      }
      default: {
        commentsStore.commit({ showEditor: false, commentBody: '{}', publishDone: false })
      }
    }
  }

  return {
    addToReplies,
    published,
    resetPublish,
  }
}
