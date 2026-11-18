import type { Query, QueryClient, QueryKey } from '@tanstack/react-query'

import type { TCommentViewerStates } from '~/lib/commentViewerState'
import type { TComment, TEmotionType, TThread, TUser } from '~/spec'

import type { TArticlePath } from '../../articlePath'
import { commentKeys, viewerQueryKeys } from '../../key'
import { commitOptimisticCache, prepareOptimisticCache } from '../optimistic/errors'
import type {
  TOptimisticChange,
  TOptimisticPlan,
  TAuthorityTarget,
  TOperationContext,
  TQueryTarget,
} from '../optimistic/types'
import {
  mapCommentPages,
  mapCommentEntries,
  commentCacheEntries,
  commentCollectionOf,
} from './pages'

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
  let changed = false
  const next: TComment[] = []
  for (const entry of entries) {
    if (String(entry.innerId) === innerId) {
      const patched = updater(entry)
      if (patched) next.push(patched)
      if (patched !== entry) changed = true
      continue
    }
    const replies = entry.replies?.length
      ? patchEntries(entry.replies, innerId, updater)
      : entry.replies
    const replyTarget = entry.replyToComment
      ? patchEntries([entry.replyToComment], innerId, updater)[0] || null
      : entry.replyToComment
    if (replies === entry.replies && replyTarget === entry.replyToComment) {
      next.push(entry)
    } else {
      changed = true
      next.push({ ...entry, replies, replyToComment: replyTarget })
    }
  }
  return changed ? next : entries
}

const findComment = (entries: TComment[], innerId: string): TComment | null => {
  for (const entry of entries) {
    if (String(entry.innerId) === innerId) return entry
    const nested = entry.replies?.length ? findComment(entry.replies, innerId) : null
    if (nested) return nested
    if (entry.replyToComment && String(entry.replyToComment.innerId) === innerId)
      return entry.replyToComment
  }
  return null
}

type TCommentPath = (number | 'replies' | 'replyToComment')[]

/** Captures every occurrence, including contextual reply targets, for entity-only rollback. */
const commentLocations = (
  entries: TComment[],
  innerId: string,
  prefix: TCommentPath = [],
): { path: TCommentPath; comment: TComment }[] =>
  entries.flatMap((entry, index) => {
    const path: TCommentPath = [...prefix, index]
    const own = String(entry.innerId) === innerId ? [{ path, comment: entry }] : []
    const replies = entry.replies?.length
      ? commentLocations(entry.replies, innerId, [...path, 'replies'])
      : []
    const target =
      entry.replyToComment && String(entry.replyToComment.innerId) === innerId
        ? [{ path: [...path, 'replyToComment'] as TCommentPath, comment: entry.replyToComment }]
        : []
    return [...own, ...replies, ...target]
  })

const restoreCommentAt = (value: unknown, path: TCommentPath, comment: TComment): unknown => {
  if (!path.length) return comment
  const [head, ...tail] = path
  if (typeof head === 'number') {
    if (!Array.isArray(value)) return value
    if (!tail.length) {
      if (String(value[head]?.innerId) === String(comment.innerId)) return value
      const entries = [...value]
      entries.splice(Math.min(head, entries.length), 0, comment)
      return entries
    }
    return value.map((entry, index) =>
      index === head ? restoreCommentAt(entry, tail, comment) : entry,
    )
  }
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  return { ...record, [head]: restoreCommentAt(record[head], tail, comment) }
}

const readCommentField = (value: unknown, innerId: string, field: keyof TComment): unknown => {
  if (!value || typeof value !== 'object') return undefined
  const entries = commentCacheEntries(value)
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
    body: { html: '', json: body },
    author: target.author || undefined,
    insertedAt: new Date().toISOString(),
    upvotesCount: 0,
    replies: [],
    rootInnerId: target.parent?.rootInnerId || target.parentId,
    emotions: [],
    ...(target.parent ? { replyToComment: target.parent } : {}),
  }) as TComment

const removePendingFromQuery = (data: unknown, pendingId: string): unknown =>
  mapCommentEntries(data, (entries) => patchEntries(entries, pendingId, () => null))

const pendingChanges = (
  queryClient: QueryClient,
  target: TCommentPendingTarget,
  context: TOperationContext,
  reply: boolean,
): TOptimisticChange[] => {
  return prepareOptimisticCache(() => {
    const changes: TOptimisticChange[] = []
    const rootId = String(target.parent?.rootInnerId || target.parentId || '')
    for (const { queryKey } of commentQueryTargets(queryClient, target.scope)) {
      const collection = commentCollectionOf(queryKey)
      const previous = queryClient.getQueryData(queryKey)
      let inserted = false
      const next = mapCommentPages(previous, (page, index) => {
        const first =
          index === 0 &&
          !collection?.initialAfter &&
          (page.pageInfo?.api !== 'offset' || page.pageInfo.page === 1)
        const direct = collection?.rootInnerId
          ? reply && collection.rootInnerId === rootId
          : !reply || collection?.mode === 'TIMELINE'
        if (direct && first) {
          inserted = true
          return { ...page, entries: [...page.entries, target.pending] }
        }
        if (!reply || collection?.rootInnerId) return page
        const append = (entries: TComment[]) => {
          let changed = false
          const next = entries.map((entry) => {
            if (String(entry.innerId) !== rootId) return entry
            changed = true
            inserted = true
            return { ...entry, replies: [...(entry.replies || []), target.pending] }
          })
          return changed ? next : entries
        }
        const entries = append(page.entries)
        const pinnedEntries = page.pinnedEntries ? append(page.pinnedEntries) : undefined
        if (entries === page.entries && pinnedEntries === page.pinnedEntries) return page
        return {
          ...page,
          entries,
          ...(page.pinnedEntries && pinnedEntries ? { pinnedEntries } : {}),
        }
      })
      if (!inserted) continue
      changes.push({
        type: 'pending-entity',
        queryKey,
        entityKey: String(target.pending.innerId) as `pending:${string}`,
        commandId: context.commandId,
        rollback: 'remove-if-owned',
        commit: () => commitOptimisticCache(() => queryClient.setQueryData(queryKey, next)),
        restore: () => {
          queryClient.setQueryData(queryKey, (current: unknown) =>
            removePendingFromQuery(current, String(target.pending.innerId)),
          )
        },
      })
    }
    return changes
  })
}

/** Inserts an optimistic root comment into cached root collection pages. */
export const insertPendingCommentChanges = (
  client: QueryClient,
  target: TCommentPendingTarget,
  context: TOperationContext,
) => pendingChanges(client, target, context, false)
/** Inserts an optimistic reply into its root's loaded reply-page projection. */
export const insertPendingReplyChanges = (
  client: QueryClient,
  target: TCommentPendingTarget,
  context: TOperationContext,
) => pendingChanges(client, target, context, true)

/** Applies one field to finite, pinned, preview and infinite owners; rollback restores only that entity. */
export const patchCommentChanges = (
  queryClient: QueryClient,
  target: TCommentTarget,
  field: Exclude<keyof TComment, 'innerId'>,
  updater: (comment: TComment) => TComment,
  context: TOperationContext,
): TOptimisticChange[] => {
  return prepareOptimisticCache(() => {
    const changes: TOptimisticChange[] = []
    for (const { queryKey } of commentQueryTargets(queryClient, target.scope)) {
      const previous = queryClient.getQueryData(queryKey)
      const before = readCommentField(previous, target.commentInnerId, field)
      if (before === undefined) continue
      const next = mapCommentEntries(previous, (entries) =>
        patchEntries(entries, target.commentInnerId, updater),
      )
      const optimistic = readCommentField(next, target.commentInnerId, field)
      changes.push({
        type: 'field',
        queryKey,
        entityKey: `${target.articleKey}:${target.commentInnerId}`,
        field: String(field),
        before,
        optimistic,
        commandId: context.commandId,
        rollback:
          field === 'upvotesCount' || field === 'emotions'
            ? 'refetch'
            : 'restore-if-owned-and-value-matches',
        commit: () => commitOptimisticCache(() => queryClient.setQueryData(queryKey, next)),
        restore: () => {
          queryClient.setQueryData(queryKey, (current: unknown) =>
            mapCommentEntries(current, (entries) => {
              const canRestore = (entries: TComment[]) =>
                entries.some((comment) => {
                  const found = findComment([comment], target.commentInnerId)
                  return found?.[field] === optimistic
                })
              if (!canRestore(entries)) return entries
              return patchEntries(entries, target.commentInnerId, (comment) => ({
                ...comment,
                [field]: before,
              }))
            }),
          )
        },
      })
    }
    return changes
  })
}

/** Applies one viewer-owned relation change with marker-guarded rollback. */
export const patchCommentViewerChanges = (
  queryClient: QueryClient,
  target: TCommentTarget,
  field: 'viewerHasUpvoted' | 'emotionFlags',
  value: boolean | { name: TEmotionType; enabled: boolean },
  context: TOperationContext,
): TOptimisticChange[] => {
  if (!context.accountScope) return []
  return prepareOptimisticCache(() => {
    const changes: TOptimisticChange[] = []
    const prefix = viewerQueryKeys.commentStatePrefix(context.accountScope!, target.articleKey)
    for (const { queryKey } of queryClient.getQueryCache().findAll({ queryKey: prefix })) {
      const previous = queryClient.getQueryData<TCommentViewerStates>(queryKey)
      const current = previous?.[target.commentInnerId]
      const emotionName = typeof value === 'object' ? value.name.toUpperCase() : ''
      const before =
        field === 'viewerHasUpvoted'
          ? current?.viewerHasUpvoted
          : current?.emotionFlags[emotionName as keyof typeof current.emotionFlags]
      if (!previous || !current || typeof before !== 'boolean') continue
      const enabled = typeof value === 'object' ? value.enabled : value
      const nextState =
        field === 'viewerHasUpvoted'
          ? { ...current, viewerHasUpvoted: enabled }
          : {
              ...current,
              emotionFlags: {
                ...current.emotionFlags,
                [emotionName]: enabled,
              },
            }
      const next = {
        ...previous,
        [target.commentInnerId]: nextState,
      }
      changes.push({
        type: 'field',
        queryKey,
        entityKey: `${target.articleKey}:${target.commentInnerId}:${field === 'emotionFlags' ? emotionName : ''}`,
        field: field === 'emotionFlags' ? `${field}:${emotionName}` : field,
        before,
        optimistic: enabled,
        commandId: context.commandId,
        rollback: 'restore-if-owned-and-value-matches',
        commit: () =>
          commitOptimisticCache(() =>
            queryClient.setQueryData<TCommentViewerStates>(queryKey, next),
          ),
        restore: () => {
          queryClient.setQueryData<TCommentViewerStates>(queryKey, (currentStates) => {
            const state = currentStates?.[target.commentInnerId]
            const currentValue =
              field === 'viewerHasUpvoted'
                ? state?.viewerHasUpvoted
                : state?.emotionFlags[emotionName as keyof typeof state.emotionFlags]
            if (!state || currentValue !== enabled) return currentStates
            return {
              ...currentStates,
              [target.commentInnerId]:
                field === 'viewerHasUpvoted'
                  ? { ...state, viewerHasUpvoted: before }
                  : { ...state, emotionFlags: { ...state.emotionFlags, [emotionName]: before } },
            }
          })
        },
      })
    }
    return changes
  })
}

/** Removes one loaded comment while retaining its exact positions for guarded restoration. */
export const deleteCommentChanges = (
  queryClient: QueryClient,
  target: TCommentTarget,
  context: TOperationContext,
): TOptimisticChange[] =>
  prepareOptimisticCache(() => {
    const changes: TOptimisticChange[] = []
    for (const { queryKey } of commentQueryTargets(queryClient, target.scope)) {
      const previous = queryClient.getQueryData(queryKey)
      const oldPages: Array<{
        page: { entries: TComment[]; pinnedEntries?: TComment[]; pageInfo?: { page?: number } }
        pageParam?: unknown
        hasPageParams: boolean
      }> = []
      let found = false
      const next = mapCommentPages(previous, (page, _index, pageParam, hasPageParams) => {
        oldPages.push({ page, pageParam, hasPageParams: Boolean(hasPageParams) })
        if (
          commentLocations(page.entries, target.commentInnerId).length ||
          commentLocations(page.pinnedEntries || [], target.commentInnerId).length
        )
          found = true
        const entries = patchEntries(page.entries, target.commentInnerId, () => null)
        const pinnedEntries = page.pinnedEntries
          ? patchEntries(page.pinnedEntries, target.commentInnerId, () => null)
          : undefined
        if (entries === page.entries && pinnedEntries === page.pinnedEntries) return page
        return {
          ...page,
          entries,
          ...(page.pinnedEntries && pinnedEntries ? { pinnedEntries } : {}),
        }
      })
      if (!found) continue
      changes.push({
        type: 'entity-delete',
        queryKey,
        entityKey: `${target.articleKey}:${target.commentInnerId}`,
        commandId: context.commandId,
        rollback: 'restore-if-owned-and-absent',
        commit: () => commitOptimisticCache(() => queryClient.setQueryData(queryKey, next)),
        restore: () =>
          queryClient.setQueryData(queryKey, (current: unknown) =>
            mapCommentPages(current, (page, index, pageParam, hasPageParams) => {
              const pageNumber = page.pageInfo?.page
              const oldSnapshot = hasPageParams
                ? oldPages.find(
                    (snapshot) =>
                      snapshot.hasPageParams && Object.is(snapshot.pageParam, pageParam),
                  )
                : pageNumber != null
                  ? oldPages.find((snapshot) => snapshot.page.pageInfo?.page === pageNumber)
                  : oldPages.length === 1 && index === 0
                    ? oldPages[0]
                    : undefined
              const oldPage = oldSnapshot?.page
              const restore = (entries: TComment[], original: TComment[] | undefined) => {
                if (!original || findComment(entries, target.commentInnerId)) return entries
                return commentLocations(original, target.commentInnerId).reduce(
                  (restored, location) =>
                    restoreCommentAt(restored, location.path, location.comment) as TComment[],
                  entries,
                )
              }
              const entries = restore(page.entries, oldPage?.entries)
              const pinnedEntries = page.pinnedEntries
                ? restore(page.pinnedEntries, oldPage?.pinnedEntries)
                : undefined
              if (entries === page.entries && pinnedEntries === page.pinnedEntries) return page
              return {
                ...page,
                entries,
                ...(page.pinnedEntries && pinnedEntries ? { pinnedEntries } : {}),
              }
            }),
          ),
      })
    }
    return changes
  })

/** Applies one comment update across timeline and nested-reply query shapes. */
export const patchCommentEverywhere = (
  queryClient: QueryClient,
  scope: TCommentScope,
  innerId: string | number,
  updater: (comment: TComment) => TComment | null,
): void => {
  queryClient.setQueriesData(
    { predicate: (query) => isCommentQueryForArticle(query, scope) },
    (data: unknown) =>
      mapCommentEntries(data, (entries) => patchEntries(entries, String(innerId), updater)),
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
    const entries = commentCacheEntries(queryClient.getQueryData(queryKey))
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
    {
      predicate: (query) =>
        isCommentQueryForArticle(query, scope) && !commentCollectionOf(query.queryKey)?.rootInnerId,
    },
    (data: unknown) =>
      mapCommentPages(data, (page, index) =>
        index === 0 && (page.pageInfo?.page || 1) === 1
          ? { ...page, entries: [...page.entries, comment] }
          : page,
      ),
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
  accountScope: string,
  articleKey: string,
  innerId: string | number,
  updater: (state: TCommentViewerStates[string]) => TCommentViewerStates[string],
): void => {
  queryClient.setQueriesData<TCommentViewerStates>(
    { queryKey: viewerQueryKeys.commentStatePrefix(accountScope, articleKey) },
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

/** Resolves the public and viewer query identities for one Comment reaction. */
const commentReactionQueryKeys = (
  context: TOperationContext,
  target: TCommentTarget,
): readonly QueryKey[] => [
  ...commentQueryTargets(context.queryClient, target.scope).map(({ queryKey }) => queryKey),
  ...(context.accountScope
    ? context.queryClient
        .getQueryCache()
        .findAll({
          queryKey: viewerQueryKeys.commentStatePrefix(context.accountScope, target.articleKey),
        })
        .map(({ queryKey }) => queryKey)
    : []),
]

/** Resolves reads to cancel before applying an optimistic Comment reaction. */
export const commentReactionCancelTargets = (
  context: TOperationContext,
  target: TCommentTarget,
): readonly TQueryTarget[] =>
  commentReactionQueryKeys(context, target).map((queryKey) => ({ queryKey, exact: true }))

/** Resolves authoritative owners to refresh after a Comment reaction outcome. */
export const commentReactionAuthorityTargets = (
  context: TOperationContext,
  target: TCommentTarget,
): readonly TAuthorityTarget[] =>
  commentReactionQueryKeys(context, target).map((queryKey) => ({ queryKey }))

/** Combines public reaction and viewer relation changes into one optimistic plan. */
export const makeCommentReactionPlan = (
  context: TOperationContext,
  target: TCommentTarget,
  publicField: Exclude<keyof TComment, 'innerId'>,
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
  return { changes }
}
