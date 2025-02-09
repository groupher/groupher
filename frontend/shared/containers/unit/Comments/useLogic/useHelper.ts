import { useSnapshot } from 'valtio'
import { propEq, findIndex, update, uniqBy, prop } from 'ramda'

import type { TComment, TEmotion } from '~/spec'

import type { TEditMode } from '../spec'
import { MODE, EDIT_MODE } from '../constant'

import store from './store'

type TRet = {
  updateOneComment: (comment: TComment, fields?: Partial<TComment>) => void
  upvoteEmotion: (comment: TComment, emotion: TEmotion) => void
  addToReplies: (replies: TComment[]) => void
  published: () => void
  resetPublish: (mode: TEditMode) => void
}

export default (): TRet => {
  const snap = useSnapshot(store)

  const updateOneComment = (comment: TComment, fields = {}): void => {
    const { id, replyToId } = comment
    const { entries } = snap.pagedComments

    if (snap.mode === MODE.REPLIES && replyToId) {
      const parentIndex = findIndex(propEq(replyToId, 'id'), entries)
      if (parentIndex < 0) return
      const parentComment = entries[parentIndex]
      const replyIndex = findIndex(propEq(id, 'id'), parentComment.replies)
      if (replyIndex < 0) return
      const replyComment = parentComment.replies[replyIndex]
      // @ts-ignore
      if (fields.meta) fields.meta = { ...replyComment.meta, ...fields.meta }
      console.log('## TODO: update one comment')
      // @ts-ignore
      // snap.pagedComments.entries[parentIndex].replies[replyIndex] = {
      //   ...replyComment,
      //   ...fields,
      // }
    } else {
      // timeline & replies parent comment
      const index = findIndex(propEq(id, 'id'), entries)

      if (index < 0) return
      const comment = entries[index]
      // @ts-ignore
      if (fields.meta) fields.meta = { ...comment.meta, ...fields.meta }

      console.log('## TODO: update one comment')
      // @ts-ignore
      // snap.pagedComments.entries[index] = { ...comment, ...fields }
    }
  }

  const upvoteEmotion = (comment: TComment, emotion: TEmotion): void => {
    const { id, replyToId } = comment
    const { entries } = snap.pagedComments

    if (snap.mode === MODE.REPLIES && replyToId) {
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
      // @ts-ignore
      // snap.pagedComments.entries[index].emotions = {
      //   ...entries[index].emotions,
      //   ...emotion,
      // }
    }
  }

  const addToReplies = (replies: TComment[]): void => {
    const { repliesParentId } = snap
    const { entries } = snap.pagedComments

    if (snap.mode === MODE.REPLIES && repliesParentId) {
      const parentIndex = findIndex(propEq(repliesParentId, 'id'), entries)

      if (parentIndex < 0) return
      const curReplies = entries[parentIndex].replies
      const uniqReplies = uniqBy(prop('id'), curReplies.concat(replies))

      // @ts-ignore
      const pagedComments = update(parentIndex, uniqReplies, snap.pagedComments.entries)
      // @ts-ignore
      snap.commit({ pagedComments })

      // self.pagedComments.entries[parentIndex].replies = uniqReplies
    }
  }

  const published = (): void => {
    snap.commit({ publishing: false, publishDone: true })
  }

  const resetPublish = (mode: TEditMode): void => {
    switch (mode) {
      case EDIT_MODE.REPLY: {
        snap.commit({
          showReplyEditor: false,
          replyBody: '{}',
          replyToComment: null,
          publishDone: false,
        })
        return
      }
      case EDIT_MODE.UPDATE: {
        snap.commit({
          showUpdateEditor: false,
          updateId: null,
          updateBody: '{}',
          publishDone: false,
        })
        return
      }
      default: {
        snap.commit({ showEditor: false, commentBody: '{}', publishDone: false })
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
