import type { Query, QueryClient } from '@tanstack/react-query'

import type { TCommentViewerStates } from '~/lib/commentViewerState'
import type { TComment, TEmotionType, TThread, TUser } from '~/spec'

import type { TArticlePath } from '../../articlePath'
import { commentKeys, viewerQueryKeys } from '../../key'
import type {
  TOptimisticChange,
  TOptimisticPlan,
  TOperationContext,
  TQueryTarget,
} from '../optimistic/types'

export type TCommentScope = {
  community: string
  thread: TThread
  articleInnerId: string | number
}

export type TCommentTarget = {
  comment: TComment
  scope: TCommentScope
  articlePath: TArticlePath
  articleKey: string
  commentInnerId: string
  commentPath: { article: TArticlePath; innerId: string }
}

/** Identifies comment queries belonging to one article scope. */
export const isCommentQueryForArticle = (query: Query, scope: TCommentScope): boolean =>
  commentKeys.matchesArticle(query, scope.community, scope.thread, scope.articleInnerId)

const patchEntries = (
  entries: TComment[],
  innerId: string,
  updater: (comment: TComment) => TComment | null,
): TComment[] => {
  const next: TComment[] = []
  for (const entry of entries) {
    if (String(entry.innerId) === innerId) {
      const patched = updater(entry)
      if (patched) next.push(patched)
      continue
    }
    if (!entry.replies?.length) {
      next.push(entry)
      continue
    }
    next.push({ ...entry, replies: patchEntries(entry.replies, innerId, updater) })
  }
  return next
}

const findComment = (entries: TComment[], innerId: string): TComment | null => {
  for (const entry of entries) {
    if (String(entry.innerId) === innerId) return entry
    const nested = entry.replies?.length ? findComment(entry.replies, innerId) : null
    if (nested) return nested
  }
  return null
}

type TCommentLocation = { parentId: string | null; index: number }

const findCommentLocation = (
  entries: TComment[],
  innerId: string,
  parentId: string | null = null,
): TCommentLocation | null => {
  for (const [index, entry] of entries.entries()) {
    if (String(entry.innerId) === innerId) return { parentId, index }
    if (entry.replies?.length) {
      const nested = findCommentLocation(entry.replies, innerId, String(entry.innerId))
      if (nested) return nested
    }
  }
  return null
}

const insertCommentAtLocation = (
  data: unknown,
  comment: TComment,
  location: TCommentLocation,
): unknown => {
  if (!data || typeof data !== 'object' || !('entries' in data)) return data
  const typed = data as { entries: TComment[] }
  if (location.parentId === null) {
    const entries = [...typed.entries]
    entries.splice(Math.min(location.index, entries.length), 0, comment)
    return { ...typed, entries }
  }
  const entries = patchEntries(typed.entries, location.parentId, (parent) => {
    const replies = [...(parent.replies || [])]
    replies.splice(Math.min(location.index, replies.length), 0, comment)
    return { ...parent, replies }
  })
  return { ...typed, entries }
}

const readCommentField = (value: unknown, innerId: string, field: keyof TComment): unknown => {
  if (!value || typeof value !== 'object') return undefined
  const entries = (value as { entries?: TComment[] }).entries
  if (!Array.isArray(entries)) return undefined
  return findComment(entries, innerId)?.[field]
}

/** Finds the exact loaded Comment Query owners for one Article. */
export const commentQueryTargets = (
  queryClient: QueryClient,
  scope: TCommentScope,
): readonly TQueryTarget[] =>
  queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => isCommentQueryForArticle(query, scope) })
    .map(({ queryKey }) => ({ queryKey, exact: true }))

export type TCommentLifecycleTarget = {
  scope: TCommentScope
  articlePath: TArticlePath
  articleKey: string
  author?: TUser | null
  parentId?: string
  parent?: TComment
}

export type TCommentPendingTarget = TCommentLifecycleTarget & { pending: TComment }

/** Serializes Comment writes that share the backend Article mutation lock. */
export const commentOperationQueueKey = (target: { articleKey: string }): string =>
  `article:${target.articleKey}:comments`

/** Builds the temporary entity owned by one create or reply command. */
export const makePendingComment = (
  context: TOperationContext,
  target: TCommentLifecycleTarget,
  body: string,
): TComment =>
  ({
    innerId: `pending:${context.commandId}`,
    bodyHtml: body,
    author: target.author || undefined,
    insertedAt: new Date().toISOString(),
    upvotesCount: 0,
    replies: [],
    emotions: [],
    ...(target.parent ? { replyToComment: target.parent } : {}),
  }) as TComment

const removePendingFromQuery = (data: unknown, pendingId: string): unknown => {
  if (!data || typeof data !== 'object' || !('entries' in data)) return data
  const typed = data as { entries: TComment[]; totalCount?: number }
  const entries = patchEntries(typed.entries, pendingId, () => null)
  if (entries.length === typed.entries.length) return data
  return { ...typed, entries, totalCount: Math.max(0, (typed.totalCount || 0) - 1) }
}

/** Inserts a top-level pending entity and records command-owned rollback changes. */
export const insertPendingCommentChanges = (
  queryClient: QueryClient,
  target: TCommentPendingTarget,
  context: TOperationContext,
): TOptimisticChange[] => {
  const changes: TOptimisticChange[] = []
  for (const { queryKey } of commentQueryTargets(queryClient, target.scope)) {
    const previous = queryClient.getQueryData(queryKey) as
      | { entries?: TComment[]; totalCount?: number; pageNumber?: number }
      | undefined
    if (!previous?.entries || (previous.pageNumber || 1) !== 1) continue
    queryClient.setQueryData(queryKey, {
      ...previous,
      entries: [target.pending, ...previous.entries],
      totalCount: (previous.totalCount || 0) + 1,
    })
    changes.push({
      type: 'pending-entity',
      queryKey,
      entityKey: String(target.pending.innerId) as `pending:${string}`,
      commandId: context.commandId,
      rollback: 'remove-if-owned',
      restore: () =>
        queryClient.setQueryData(queryKey, (current) =>
          removePendingFromQuery(current, String(target.pending.innerId)),
        ),
    })
  }
  return changes
}

/** Inserts a pending reply below its loaded parent with command-owned rollback. */
export const insertPendingReplyChanges = (
  queryClient: QueryClient,
  target: TCommentPendingTarget,
  context: TOperationContext,
): TOptimisticChange[] => {
  if (!target.parentId) return []
  const changes: TOptimisticChange[] = []
  for (const { queryKey } of commentQueryTargets(queryClient, target.scope)) {
    const previous = queryClient.getQueryData(queryKey) as { entries?: TComment[] } | undefined
    if (!previous?.entries || !findComment(previous.entries, target.parentId)) continue
    queryClient.setQueryData(queryKey, {
      ...previous,
      entries: patchEntries(previous.entries, target.parentId, (comment) => ({
        ...comment,
        replies: [...(comment.replies || []), target.pending],
      })),
    })
    changes.push({
      type: 'pending-entity',
      queryKey,
      entityKey: String(target.pending.innerId) as `pending:${string}`,
      commandId: context.commandId,
      rollback: 'remove-if-owned',
      restore: () =>
        queryClient.setQueryData(queryKey, (current: unknown) => {
          if (!current || typeof current !== 'object' || !('entries' in current)) return current
          return {
            ...(current as { entries: TComment[] }),
            entries: patchEntries(
              (current as { entries: TComment[] }).entries,
              String(target.pending.innerId),
              () => null,
            ),
          }
        }),
    })
  }
  return changes
}

/** Applies one Comment field change across loaded feeds and records its inverse. */
export const patchCommentChanges = (
  queryClient: QueryClient,
  target: TCommentTarget,
  field: keyof TComment,
  updater: (comment: TComment) => TComment | null,
  context: TOperationContext,
): TOptimisticChange[] => {
  const changes: TOptimisticChange[] = []
  for (const { queryKey } of commentQueryTargets(queryClient, target.scope)) {
    const previous = queryClient.getQueryData(queryKey)
    const before = readCommentField(previous, target.commentInnerId, field)
    const beforeComment =
      field === 'innerId'
        ? findComment(
            (previous as { entries?: TComment[] } | undefined)?.entries || [],
            target.commentInnerId,
          )
        : null
    const beforeLocation =
      field === 'innerId'
        ? findCommentLocation(
            (previous as { entries?: TComment[] } | undefined)?.entries || [],
            target.commentInnerId,
          )
        : null
    const next =
      previous && typeof previous === 'object' && 'entries' in previous
        ? {
            ...(previous as { entries: TComment[] }),
            entries: patchEntries(
              (previous as { entries: TComment[] }).entries,
              target.commentInnerId,
              updater,
            ),
          }
        : previous
    if (next === previous || before === undefined) continue
    queryClient.setQueryData(queryKey, next)
    changes.push({
      type: 'field',
      queryKey,
      entityKey: `${target.articleKey}:${target.commentInnerId}`,
      field: String(field),
      before,
      optimistic: readCommentField(next, target.commentInnerId, field),
      commandId: context.commandId,
      rollback: field === 'upvotesCount' || field === 'emotions' ? 'refetch' : 'restore-if-owned',
      restore: () => {
        queryClient.setQueryData(queryKey, (current: unknown) => {
          if (!current || typeof current !== 'object' || !('entries' in current)) return current
          if (
            field === 'innerId' &&
            beforeComment &&
            beforeLocation &&
            readCommentField(current, target.commentInnerId, 'innerId') === undefined
          ) {
            return insertCommentAtLocation(current, beforeComment, beforeLocation)
          }
          return {
            ...(current as { entries: TComment[] }),
            entries: patchEntries(
              (current as { entries: TComment[] }).entries,
              target.commentInnerId,
              (comment) => ({ ...comment, [field]: before }),
            ),
          }
        })
      },
    })
  }
  return changes
}

/** Applies one viewer-owned relation change with marker-guarded rollback. */
export const patchCommentViewerChanges = (
  queryClient: QueryClient,
  target: TCommentTarget,
  field: 'viewerHasUpvoted' | 'viewerHasReported' | 'emotionFlags',
  value: boolean | { name: TEmotionType; enabled: boolean },
  context: TOperationContext,
): TOptimisticChange[] => {
  if (!context.accountRef) return []
  const changes: TOptimisticChange[] = []
  const prefix = viewerQueryKeys.commentStatePrefix(context.accountRef, target.articleKey)
  for (const { queryKey } of queryClient.getQueryCache().findAll({ queryKey: prefix })) {
    const previous = queryClient.getQueryData<TCommentViewerStates>(queryKey)
    const current = previous?.[target.commentInnerId]
    const emotionName = typeof value === 'object' ? value.name.toUpperCase() : ''
    const before =
      field === 'viewerHasUpvoted'
        ? current?.viewerHasUpvoted
        : field === 'viewerHasReported'
          ? current?.viewerHasReported
          : current?.emotionFlags[emotionName as keyof typeof current.emotionFlags]
    if (!previous || !current || typeof before !== 'boolean') continue
    const enabled = typeof value === 'object' ? value.enabled : value
    const nextState =
      field === 'viewerHasUpvoted'
        ? { ...current, viewerHasUpvoted: enabled }
        : field === 'viewerHasReported'
          ? { ...current, viewerHasReported: enabled }
          : {
              ...current,
              emotionFlags: {
                ...current.emotionFlags,
                [emotionName]: enabled,
              },
            }
    queryClient.setQueryData<TCommentViewerStates>(queryKey, {
      ...previous,
      [target.commentInnerId]: nextState,
    })
    changes.push({
      type: 'field',
      queryKey,
      entityKey: `${target.articleKey}:${target.commentInnerId}:${field === 'emotionFlags' ? emotionName : ''}`,
      field: field === 'emotionFlags' ? `${field}:${emotionName}` : field,
      before,
      optimistic: enabled,
      commandId: context.commandId,
      rollback: 'restore-if-owned',
      restore: () => {
        queryClient.setQueryData<TCommentViewerStates>(queryKey, (currentStates) => {
          const state = currentStates?.[target.commentInnerId]
          if (!state) return currentStates
          return {
            ...currentStates,
            [target.commentInnerId]:
              field === 'viewerHasUpvoted'
                ? { ...state, viewerHasUpvoted: before }
                : field === 'viewerHasReported'
                  ? { ...state, viewerHasReported: before }
                  : { ...state, emotionFlags: { ...state.emotionFlags, [emotionName]: before } },
          }
        })
      },
    })
  }
  return changes
}

/** Applies one comment update across timeline and nested-reply query shapes. */
export const patchCommentEverywhere = (
  queryClient: QueryClient,
  scope: TCommentScope,
  innerId: string | number,
  updater: (comment: TComment) => TComment | null,
): void => {
  queryClient.setQueriesData(
    { predicate: (query) => isCommentQueryForArticle(query, scope) },
    (data: { entries?: TComment[] } | undefined) =>
      data?.entries
        ? {
            ...data,
            entries: patchEntries(data.entries, String(innerId), updater),
          }
        : data,
  )
}

/** Reads the canonical comment entity from any loaded query for its Article. */
export const selectCommentFromCache = (
  queryClient: QueryClient,
  scope: TCommentScope,
  comment: TComment,
): TComment => {
  const innerId = String(comment.innerId)
  for (const { queryKey } of commentQueryTargets(queryClient, scope)) {
    const entries = queryClient.getQueryData<{ entries?: TComment[] }>(queryKey)?.entries
    if (!entries) continue
    const match = findComment(entries, innerId)
    if (match) return match
  }
  return comment
}

/** Inserts a temporary top-level comment into loaded first-page comment queries. */
export const insertPendingComment = (
  queryClient: QueryClient,
  scope: TCommentScope,
  comment: TComment,
): void => {
  queryClient.setQueriesData(
    { predicate: (query) => isCommentQueryForArticle(query, scope) },
    (data: { entries?: TComment[]; totalCount?: number; pageNumber?: number } | undefined) =>
      data?.entries && (data.pageNumber || 1) === 1
        ? {
            ...data,
            entries: [comment, ...data.entries],
            totalCount: (data.totalCount || 0) + 1,
          }
        : data,
  )
}

/** Inserts a temporary reply below its parent in every loaded comment shape. */
export const insertPendingReply = (
  queryClient: QueryClient,
  scope: TCommentScope,
  parentId: string | number,
  reply: TComment,
): void => {
  patchCommentEverywhere(queryClient, scope, parentId, (parent) => ({
    ...parent,
    replies: [...(parent.replies || []), reply],
  }))
}

/** Replaces a pending comment after its mutation has applied committed ArticleStats. */
export const reconcileCreatedComment = (
  queryClient: QueryClient,
  scope: TCommentScope,
  pendingInnerId: string | number,
  confirmed: TComment,
): void => {
  patchCommentEverywhere(queryClient, scope, pendingInnerId, () => confirmed)
}

/** Updates viewer-owned comment flags without replacing public aggregates. */
export const patchCommentViewerState = (
  queryClient: QueryClient,
  accountRef: string,
  articleKey: string,
  innerId: string | number,
  updater: (state: TCommentViewerStates[string]) => TCommentViewerStates[string],
): void => {
  queryClient.setQueriesData<TCommentViewerStates>(
    { queryKey: viewerQueryKeys.commentStatePrefix(accountRef, articleKey) },
    (states) => {
      if (!states) return states
      const key = String(innerId)
      return {
        ...states,
        [key]: updater(states[key] || { emotionFlags: {} }),
      }
    },
  )
}

/** Updates a public emotion count while stripping viewer-owned reaction flags. */
export const updateCommentEmotion = (
  comment: TComment,
  type: string,
  nextViewerState: boolean,
): TComment => {
  const emotionType = type.toUpperCase()
  const emotions = comment.emotions || []
  const exists = emotions.some((emotion) => emotion.type === emotionType)
  const nextEmotions = emotions.map((emotion) => {
    const { viewerHasReacted: _viewerHasReacted, ...publicEmotion } = emotion
    return emotion.type === emotionType
      ? {
          ...publicEmotion,
          count: Math.max(0, (emotion.count || 0) + (nextViewerState ? 1 : -1)),
        }
      : publicEmotion
  })

  return {
    ...comment,
    emotions: exists
      ? nextEmotions
      : [
          ...nextEmotions,
          {
            type: emotionType,
            count: nextViewerState ? 1 : 0,
            latestUsers: [],
          },
        ],
  } as TComment
}

export type TCommentMutationResult = TComment

/** Removes viewer flags before storing the public emotion projection. */
export const publicEmotions = (comment: TComment): TComment['emotions'] =>
  (comment.emotions || []).map((emotion) => {
    const { viewerHasReacted: _viewerHasReacted, ...publicEmotion } = emotion
    return publicEmotion
  }) as TComment['emotions']

/** Deduplicates exact authority refetches for non-invertible aggregate changes. */
export const authorityQueries = (changes: readonly TOptimisticChange[]) => [
  ...new Map(
    changes
      .filter((change) => change.rollback === 'refetch')
      .map(({ queryKey }) => [JSON.stringify(queryKey), { queryKey, exact: true as const }]),
  ).values(),
]

/** Resolves public and viewer Query owners affected by one Comment reaction. */
export const commentTargetQueries = (
  context: TOperationContext,
  target: TCommentTarget,
): readonly TQueryTarget[] => [
  ...commentQueryTargets(context.queryClient, target.scope),
  ...(context.accountRef
    ? context.queryClient
        .getQueryCache()
        .findAll({
          queryKey: viewerQueryKeys.commentStatePrefix(context.accountRef, target.articleKey),
        })
        .map(({ queryKey }) => ({ queryKey, exact: true }))
    : []),
]

/** Combines public reaction and viewer relation changes into one optimistic plan. */
export const makeCommentReactionPlan = (
  context: TOperationContext,
  target: TCommentTarget,
  publicField: keyof TComment,
  publicUpdater: (comment: TComment) => TComment,
  viewerField: 'viewerHasUpvoted' | 'emotionFlags',
  viewerValue: boolean | { name: TEmotionType; enabled: boolean },
): TOptimisticPlan => {
  const changes = patchCommentChanges(
    context.queryClient,
    target,
    publicField,
    publicUpdater,
    context,
  )
  changes.push(
    ...patchCommentViewerChanges(context.queryClient, target, viewerField, viewerValue, context),
  )
  return { changes, refetchOnFailure: authorityQueries(changes) }
}
