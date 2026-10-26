import type { TComment, TEmotionRawType } from '~/spec'

type TCommentEmotionType = Exclude<TEmotionRawType, 'UPVOTE'>

export type TCommentViewerState = {
  viewerHasUpvoted?: boolean
  emotionFlags: Partial<Record<TCommentEmotionType, boolean>>
}

export type TCommentViewerStates = Record<string, TCommentViewerState>

const stripComment = (comment: TComment): TComment => {
  const { viewerHasUpvoted: _viewerHasUpvoted, ...publicComment } = comment
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

/** Gathers every comment innerId addressed by the viewer batch query. */
export const gatherCommentViewerIds = (comments: { entries: readonly TComment[] }): string[] => {
  const ids: string[] = []
  const visited = new Set<string>()

  const gather = (comment: TComment): void => {
    const innerId = String(comment.innerId)
    if (innerId.startsWith('pending:') || visited.has(innerId)) return
    visited.add(innerId)
    ids.push(innerId)

    for (const reply of comment.replies || []) gather(reply)
    if (comment.replyToComment) gather(comment.replyToComment)
  }

  for (const comment of comments.entries) gather(comment)
  return ids
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
    emotions,
    replies: comment.replies?.map((reply) => mergeCommentViewerState(reply, states)) || [],
    replyToComment: comment.replyToComment
      ? mergeCommentViewerState(comment.replyToComment, states)
      : null,
  } as TComment
}
