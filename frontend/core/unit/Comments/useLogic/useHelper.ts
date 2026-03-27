import { findIndex, prop, propEq, uniqBy } from 'ramda'
import { useContext } from 'react'

import type { TComment, TEmotion, TID } from '~/spec'
import { StoreContext as CommentsStoreContext } from '~/stores/comments/provider'
import { EDIT_MODE, MODE } from '../constant'
import type { TEditMode } from '../spec'

type TRet = {
  updateOneComment: (comment: TComment, fields?: Partial<TComment>) => void
  upvoteEmotion: (comment: TComment, emotion: TEmotion) => void
  addToReplies: (parentId: TID, replies: TComment[]) => void
  published: () => void
  resetPublish: (mode: TEditMode) => void
}

export default function useHelper(): TRet {
  const commentsStore = useContext(CommentsStoreContext) as any
  if (!commentsStore) {
    throw new Error('useHelper must be used within a Comments store provider')
  }
  const comments = commentsStore

  const updateOneComment = (comment: TComment, fields = {}): void => {
    const { id, replyToId } = comment
    const { entries } = comments.pagedComments

    if (comments.mode === MODE.REPLIES && replyToId) {
      const parentIndex = findIndex(propEq(replyToId, 'id'), entries)
      if (parentIndex < 0) return
      const parentComment = entries[parentIndex]
      const replyIndex = findIndex(propEq(id, 'id'), parentComment.replies)
      if (replyIndex < 0) return
      const replyComment = parentComment.replies[replyIndex]
      // @ts-expect-error
      if (fields.meta) fields.meta = { ...replyComment.meta, ...fields.meta }
      console.log('## TODO: update one comment')
      // snap.pagedComments.entries[parentIndex].replies[replyIndex] = {
      //   ...replyComment,
      //   ...fields,
      // }
    } else {
      // timeline & replies parent comment
      const index = findIndex(propEq(id, 'id'), entries)

      if (index < 0) return
      const comment = entries[index]
      // @ts-expect-error
      if (fields.meta) fields.meta = { ...comment.meta, ...fields.meta }

      console.log('## TODO: update one comment')
      // snap.pagedComments.entries[index] = { ...comment, ...fields }
    }
  }

  const upvoteEmotion = (comment: TComment, emotion: TEmotion): void => {
    const { id, replyToId } = comment
    const { entries } = comments.pagedComments

    if (comments.mode === MODE.REPLIES && replyToId) {
      const parentIndex = findIndex(propEq(replyToId, 'id'), entries)
      if (parentIndex < 0) return
      const parentComment = entries[parentIndex]
      const replyIndex = findIndex(propEq(id, 'id'), parentComment.replies)
      if (replyIndex < 0) return
      // const replyComment = parentComment.replies[replyIndex]

      console.log('## TODO updateEmotion: ', emotion)
      // const newEmotions = {
      //   ...replyComment.emotions,
      //   ...emotion,
      // }

      // snap.pagedComments.entries[parentIndex].replies[replyIndex].emotions = {
      //   ...replyComment.emotions,
      //   ...emotion,
      // }
    } else {
      const index = findIndex(propEq(id, 'id'), entries)
      if (index < 0) return
      console.log('## TODO updateEmotion: ', emotion)
      // snap.pagedComments.entries[index].emotions = {
      //   ...entries[index].emotions,
      //   ...emotion,
      // }
    }
  }

  const addToReplies = (parentId: TID, replies: TComment[]): void => {
    const { entries } = comments.pagedComments

    if (comments.mode === MODE.REPLIES && parentId) {
      const parentIndex = findIndex(propEq(parentId, 'id'), entries)

      if (parentIndex < 0) return
      const curReplies = entries[parentIndex].replies || []
      const uniqReplies = uniqBy(prop('id'), [...curReplies, ...replies]) as TComment[]

      const entriesPatch = entries.map((item, index) =>
        index === parentIndex ? { ...item, replies: uniqReplies } : item,
      ) as unknown as TComment[]
      commentsStore.commit({
        pagedComments: {
          ...comments.pagedComments,
          entries: entriesPatch,
        },
      })

      // self.pagedComments.entries[parentIndex].replies = uniqReplies
    }
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
          updateId: null,
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
    updateOneComment,
    upvoteEmotion,
    addToReplies,
    published,
    resetPublish,
  }
}
