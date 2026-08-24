import type { TComment, TEmotionRawType, TPagedComments } from '~/spec'

type TCommentEmotionType = Exclude<TEmotionRawType, 'UPVOTE'>

export type TCommentViewerState = {
  viewerHasUpvoted?: boolean
  viewerHasReported?: boolean
  emotionFlags: Partial<Record<TCommentEmotionType, boolean>>
}

export type TCommentViewerStates = Record<string, TCommentViewerState>

const stripComment = (comment: TComment): TComment => {
  const {
    viewerHasUpvoted: _viewerHasUpvoted,
    viewerHasReported: _viewerHasReported,
    ...publicComment
  } = comment
  const emotions = (comment.emotions || []).map((emotion) => {
    const { viewerHasReacted: _viewerHasReacted, ...publicEmotion } = emotion
    return publicEmotion
  })

  return {
    ...publicComment,
    emotions,
    replies: comment.replies?.map(stripComment) || [],
    replyToComment: comment.replyToComment ? stripComment(comment.replyToComment) : null,
  } as TComment
}

/** Removes viewer-private fields from every comment-bearing path in one comment graph. */
export const stripCommentViewerState = (comment: TComment): TComment => stripComment(comment)

/** Removes viewer-private fields before a paged comment response enters public Query cache. */
export const stripPagedCommentViewerState = (comments: TPagedComments): TPagedComments => ({
  ...comments,
  entries: (comments.entries as unknown as TComment[]).map(stripComment),
})

/** Extracts the current viewer flags from an authenticated, unstripped comment response. */
export const extractCommentViewerStates = (comments: TPagedComments): TCommentViewerStates => {
  const states: TCommentViewerStates = {}
  const visited = new Set<string>()

  const collect = (comment: TComment): void => {
    const innerId = String(comment.innerId)
    if (visited.has(innerId)) return
    visited.add(innerId)

    const emotionFlags: TCommentViewerState['emotionFlags'] = {}
    for (const emotion of comment.emotions || []) {
      if (emotion.type === 'UPVOTE' || typeof emotion.viewerHasReacted !== 'boolean') continue
      emotionFlags[emotion.type as TCommentEmotionType] = emotion.viewerHasReacted
    }

    states[innerId] = {
      emotionFlags,
      viewerHasUpvoted: comment.viewerHasUpvoted,
      viewerHasReported: comment.viewerHasReported,
    }

    for (const reply of comment.replies || []) collect(reply)
    if (comment.replyToComment) collect(comment.replyToComment)
  }

  for (const comment of comments.entries as unknown as TComment[]) collect(comment)
  return states
}

/** Overlays viewer flags without allowing private query data to replace public aggregates. */
export const mergeCommentViewerState = (
  comment: TComment,
  states: TCommentViewerStates,
): TComment => {
  const state = states[String(comment.innerId)]
  const emotions = (comment.emotions || []).map((emotion) => {
    const viewerHasReacted = state?.emotionFlags[emotion.type as TCommentEmotionType]
    return typeof viewerHasReacted === 'boolean' ? { ...emotion, viewerHasReacted } : emotion
  })

  return {
    ...comment,
    ...(typeof state?.viewerHasUpvoted === 'boolean'
      ? { viewerHasUpvoted: state.viewerHasUpvoted }
      : {}),
    ...(typeof state?.viewerHasReported === 'boolean'
      ? { viewerHasReported: state.viewerHasReported }
      : {}),
    emotions,
    replies: comment.replies?.map((reply) => mergeCommentViewerState(reply, states)) || [],
    replyToComment: comment.replyToComment
      ? mergeCommentViewerState(comment.replyToComment, states)
      : null,
  } as TComment
}
