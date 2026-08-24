import type { QueryClient } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import { graphql } from '~/graphql/authoring'
import { browserQuery } from '~/graphql/client'
import type { TArticle, TThread } from '~/spec'

import { articleKeys, mutationKeys, viewerKeys } from '../key'
import type { TArticleViewerState } from '../viewer'

const upvotePost = graphql(`
  mutation QueryUpvotePost($article: ArticlePathInput!) {
    upvotePost(article: $article) {
      innerId
      upvotesCount
      ... on Post {
        viewerHasUpvoted
      }
    }
  }
`)

const undoUpvotePost = graphql(`
  mutation QueryUndoUpvotePost($article: ArticlePathInput!) {
    undoUpvotePost(article: $article) {
      innerId
      upvotesCount
      ... on Post {
        viewerHasUpvoted
      }
    }
  }
`)

const upvoteChangelog = graphql(`
  mutation QueryUpvoteChangelog($article: ArticlePathInput!) {
    upvoteChangelog(article: $article) {
      innerId
      upvotesCount
      ... on Changelog {
        viewerHasUpvoted
      }
    }
  }
`)

const undoUpvoteChangelog = graphql(`
  mutation QueryUndoUpvoteChangelog($article: ArticlePathInput!) {
    undoUpvoteChangelog(article: $article) {
      innerId
      upvotesCount
      ... on Changelog {
        viewerHasUpvoted
      }
    }
  }
`)

const upvoteDoc = graphql(`
  mutation QueryUpvoteDoc($article: ArticlePathInput!) {
    upvoteDoc(article: $article) {
      innerId
      upvotesCount
      ... on Doc {
        viewerHasUpvoted
      }
    }
  }
`)

const undoUpvoteDoc = graphql(`
  mutation QueryUndoUpvoteDoc($article: ArticlePathInput!) {
    undoUpvoteDoc(article: $article) {
      innerId
      upvotesCount
      ... on Doc {
        viewerHasUpvoted
      }
    }
  }
`)

type TArticlePath = { community: string; thread: TThread; innerId: string }

const isTarget = (article: Partial<TArticle>, path: TArticlePath): boolean =>
  String(article.innerId) === path.innerId &&
  article.community?.slug === path.community &&
  article.meta?.thread === path.thread

const patchData = (
  value: unknown,
  path: TArticlePath,
  updater: (article: TArticle) => TArticle,
): unknown => {
  if (!value || typeof value !== 'object') return value
  if (isTarget(value as TArticle, path)) return updater(value as TArticle)

  const paged = value as { entries?: TArticle[] }
  if (!Array.isArray(paged.entries)) return value

  let changed = false
  const entries = paged.entries.map((article) => {
    if (!isTarget(article, path)) return article
    changed = true
    return updater(article)
  })
  return changed ? { ...paged, entries } : value
}

const ARTICLE_ENTITY_QUERY_KINDS = new Set(['changelogs', 'detail', 'posts'])

const isArticleEntityQuery = (query: { queryKey: readonly unknown[] }): boolean =>
  query.queryKey[0] === articleKeys.all[0] &&
  typeof query.queryKey[1] === 'string' &&
  ARTICLE_ENTITY_QUERY_KINDS.has(query.queryKey[1])

/** Applies one entity update to every registered article-bearing query shape. */
export const patchArticleEverywhere = (
  queryClient: QueryClient,
  path: TArticlePath,
  updater: (article: TArticle) => TArticle,
): void => {
  queryClient.setQueriesData({ predicate: isArticleEntityQuery }, (data) =>
    patchData(data, path, updater),
  )
}

const patchViewerState = (
  queryClient: QueryClient,
  viewerScope: string,
  articleKey: string,
  viewerHasUpvoted: boolean,
): void => {
  queryClient.setQueriesData<Record<string, TArticleViewerState>>(
    { queryKey: [...viewerKeys.all, viewerScope, 'article-state'] },
    (states) =>
      states
        ? {
            ...states,
            [articleKey]: { ...states[articleKey], articleKey, viewerHasUpvoted },
          }
        : states,
  )
  queryClient.setQueryData(
    viewerKeys.articleState(viewerScope, articleKey),
    (state: TArticleViewerState | undefined) => (state ? { ...state, viewerHasUpvoted } : state),
  )
}

/** Optimistically toggles an article and reconciles public and viewer query state. */
export const toggleArticleUpvote = async (
  queryClient: QueryClient,
  article: TArticle,
  nextViewerState: boolean,
  viewerScope: string,
): Promise<boolean> => {
  const path = {
    community: article.community.slug,
    thread: article.meta.thread,
    innerId: String(article.innerId),
  }
  const articleKey = `${path.community}:${path.thread}:${path.innerId}`
  await Promise.all([
    queryClient.cancelQueries({ queryKey: articleKeys.all }),
    queryClient.cancelQueries({ queryKey: [...viewerKeys.all, viewerScope] }),
  ])
  const articleSnapshots = queryClient.getQueriesData({ queryKey: articleKeys.all })
  const viewerSnapshots = queryClient.getQueriesData({ queryKey: [...viewerKeys.all, viewerScope] })

  patchArticleEverywhere(queryClient, path, (current) => ({
    ...current,
    upvotesCount: Math.max(0, current.upvotesCount + (nextViewerState ? 1 : -1)),
  }))
  patchViewerState(queryClient, viewerScope, articleKey, nextViewerState)

  try {
    const variables = { article: path }
    const result =
      path.thread === THREAD.CHANGELOG
        ? nextViewerState
          ? (await browserQuery(upvoteChangelog, variables)).upvoteChangelog
          : (await browserQuery(undoUpvoteChangelog, variables)).undoUpvoteChangelog
        : path.thread === THREAD.DOC
          ? nextViewerState
            ? (await browserQuery(upvoteDoc, variables)).upvoteDoc
            : (await browserQuery(undoUpvoteDoc, variables)).undoUpvoteDoc
          : nextViewerState
            ? (await browserQuery(upvotePost, variables)).upvotePost
            : (await browserQuery(undoUpvotePost, variables)).undoUpvotePost

    patchArticleEverywhere(queryClient, path, (current) => ({
      ...current,
      upvotesCount: result.upvotesCount,
    }))
    const confirmedViewerState =
      'viewerHasUpvoted' in result && typeof result.viewerHasUpvoted === 'boolean'
        ? result.viewerHasUpvoted
        : nextViewerState
    patchViewerState(queryClient, viewerScope, articleKey, confirmedViewerState)
    await queryClient.invalidateQueries({ queryKey: articleKeys.all, refetchType: 'none' })
    return true
  } catch {
    for (const [key, data] of articleSnapshots) queryClient.setQueryData(key, data)
    for (const [key, data] of viewerSnapshots) queryClient.setQueryData(key, data)
    return false
  }
}

type TArticleUpvoteIntent = {
  desired: boolean
  promise: Promise<void>
}

const articleUpvoteIntents = new WeakMap<QueryClient, Map<string, TArticleUpvoteIntent>>()

const executeArticleUpvoteMutation = async (
  queryClient: QueryClient,
  article: TArticle,
  nextViewerState: boolean,
  viewerScope: string,
  articleKey: string,
): Promise<void> => {
  const mutationCache = queryClient.getMutationCache()
  const mutation = mutationCache.build(queryClient, {
    mutationKey: mutationKeys.article(articleKey, 'upvote'),
    scope: { id: `article:${articleKey}:upvote` },
    retry: false,
    mutationFn: async () => {
      const success = await toggleArticleUpvote(queryClient, article, nextViewerState, viewerScope)
      if (!success) throw new Error('Article upvote failed')
    },
  })

  try {
    await mutation.execute(undefined)
  } finally {
    mutationCache.remove(mutation)
  }
}

/** Executes article upvote intent through TanStack's observable, serial operation lane. */
export const mutateArticleUpvote = (
  queryClient: QueryClient,
  article: TArticle,
  nextViewerState: boolean,
  viewerScope: string,
): Promise<void> => {
  const articleKey = `${article.community.slug}:${article.meta.thread}:${article.innerId}`
  let intents = articleUpvoteIntents.get(queryClient)
  if (!intents) {
    intents = new Map()
    articleUpvoteIntents.set(queryClient, intents)
  }

  const activeIntent = intents.get(articleKey)
  if (activeIntent) {
    // Each bridge event represents one user toggle. Do not trust a second target
    // calculated from a render that may still carry the pre-mutation viewer flag.
    activeIntent.desired = !activeIntent.desired
    return activeIntent.promise
  }

  const intent = { desired: nextViewerState, promise: Promise.resolve() }
  intent.promise = (async () => {
    let applied: boolean | undefined
    do {
      applied = intent.desired
      await executeArticleUpvoteMutation(queryClient, article, applied, viewerScope, articleKey)
    } while (intent.desired !== applied)
  })().finally(() => {
    if (intents?.get(articleKey) === intent) intents.delete(articleKey)
  })
  intents.set(articleKey, intent)

  return intent.promise
}
