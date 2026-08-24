import type { VariablesOf } from '@graphql-typed-document-node/core'
import { queryOptions } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import { graphql } from '~/graphql/authoring'
import { browserQuery } from '~/graphql/client'
import { extractCommentViewerStates, type TCommentViewerStates } from '~/lib/commentViewerState'
import type { TCommentsState, TPagedArticlesParams, TPagedComments, TThread } from '~/spec'
import commentsSchema from '~/unit/Comments/schema'

import { normalizeArticleFilter, viewerKeys } from './key'

export type TArticleViewerState = {
  articleKey: string
  viewerHasViewed?: boolean
  viewerHasUpvoted?: boolean
}

export const viewerArticleStates = graphql(`
  query ViewerArticleStates($filter: PagedPostsFilter!) {
    pagedPosts(filter: $filter) {
      entries {
        innerId
        community {
          slug
        }
        meta {
          thread
        }
        viewerHasViewed
        viewerHasUpvoted
      }
    }
  }
`)

const viewerChangelogStates = graphql(`
  query ViewerChangelogStates($filter: PagedChangelogsFilter!) {
    pagedChangelogs(filter: $filter) {
      entries {
        innerId
        community {
          slug
        }
        meta {
          thread
        }
        viewerHasViewed
        viewerHasUpvoted
      }
    }
  }
`)

const postViewerState = graphql(`
  query PostViewerState($article: ArticlePathInput!) {
    post(article: $article) {
      innerId
      viewerHasCollected
      viewerHasUpvoted
    }
  }
`)

const changelogViewerState = graphql(`
  query ChangelogViewerState($article: ArticlePathInput!) {
    changelog(article: $article) {
      innerId
      viewerHasCollected
      viewerHasUpvoted
    }
  }
`)

const docViewerState = graphql(`
  query DocViewerState($article: ArticlePathInput!) {
    doc(article: $article) {
      innerId
      viewerHasCollected
      viewerHasUpvoted
    }
  }
`)

const articleStates = (
  viewerScope: string,
  filter: TPagedArticlesParams,
  articleKeys: readonly string[],
) =>
  queryOptions({
    queryKey: viewerKeys.articleStates(viewerScope, articleKeys),
    queryFn: async () => {
      const normalized = normalizeArticleFilter(filter)
      const data = await browserQuery(viewerArticleStates, {
        filter: {
          community: normalized.community,
          page: normalized.page,
          size: normalized.size,
          communityTag: normalized.communityTag,
          cat: normalized.cat as VariablesOf<typeof viewerArticleStates>['filter']['cat'],
          status: normalized.status as VariablesOf<typeof viewerArticleStates>['filter']['status'],
          order: normalized.order as VariablesOf<typeof viewerArticleStates>['filter']['order'],
        },
      })

      return Object.fromEntries(
        data.pagedPosts.entries.map((article) => {
          const key = `${article.community.slug}:${article.meta.thread}:${article.innerId}`
          return [
            key,
            {
              articleKey: key,
              viewerHasViewed: article.viewerHasViewed,
              viewerHasUpvoted: article.viewerHasUpvoted,
            } satisfies TArticleViewerState,
          ]
        }),
      ) as Record<string, TArticleViewerState>
    },
    enabled: !!viewerScope && articleKeys.length > 0,
    staleTime: 30_000,
  })

const articleState = (
  viewerScope: string,
  community: string,
  thread: TThread,
  innerId: string | number,
) =>
  queryOptions({
    queryKey: viewerKeys.articleState(viewerScope, `${community}:${thread}:${String(innerId)}`),
    queryFn: async () => {
      const article = { community, thread, innerId: String(innerId) }
      if (thread === THREAD.CHANGELOG) {
        const data = await browserQuery(changelogViewerState, { article })
        return data.changelog
      }
      if (thread === THREAD.DOC) {
        const data = await browserQuery(docViewerState, { article })
        return data.doc
      }
      const data = await browserQuery(postViewerState, { article })
      return data.post
    },
    enabled: !!viewerScope && !!community && !!innerId,
    staleTime: 30_000,
  })

const changelogStates = (
  viewerScope: string,
  filter: TPagedArticlesParams,
  articleKeys: readonly string[],
) =>
  queryOptions({
    queryKey: viewerKeys.articleStates(viewerScope, articleKeys),
    queryFn: async () => {
      const normalized = normalizeArticleFilter(filter)
      const data = await browserQuery(viewerChangelogStates, {
        filter: {
          community: normalized.community,
          page: normalized.page,
          size: normalized.size,
          communityTag: normalized.communityTag,
          order: normalized.order as VariablesOf<typeof viewerChangelogStates>['filter']['order'],
        },
      })
      return Object.fromEntries(
        data.pagedChangelogs.entries.map((article) => {
          const key = `${article.community.slug}:${article.meta.thread}:${article.innerId}`
          return [
            key,
            {
              articleKey: key,
              viewerHasViewed: article.viewerHasViewed,
              viewerHasUpvoted: article.viewerHasUpvoted,
            },
          ]
        }),
      ) as Record<string, TArticleViewerState>
    },
    enabled: !!viewerScope && articleKeys.length > 0,
    staleTime: 30_000,
  })

const commentStates = (
  viewerScope: string,
  community: string,
  thread: TThread,
  innerId: string | number,
  page: number,
  mode: string,
) =>
  queryOptions({
    queryKey: viewerKeys.commentStates(
      viewerScope,
      `${community}:${thread}:${String(innerId)}`,
      page,
      mode,
    ),
    queryFn: async () => {
      const data = await browserQuery(commentsSchema.pagedComments, {
        article: { community, thread, innerId: String(innerId) },
        mode: mode as 'REPLIES' | 'TIMELINE',
        filter: { page, size: 30 },
      })
      return extractCommentViewerStates(
        data.pagedComments as unknown as TPagedComments,
      ) satisfies TCommentViewerStates
    },
    enabled: !!viewerScope && !!community && !!innerId,
    staleTime: 30_000,
  })

const commentSummary = (
  viewerScope: string,
  community: string,
  thread: TThread,
  innerId: string | number,
) =>
  queryOptions({
    queryKey: viewerKeys.commentSummary(viewerScope, `${community}:${thread}:${String(innerId)}`),
    queryFn: async () => {
      const data = await browserQuery(commentsSchema.commentsState, {
        article: { community, thread, innerId: String(innerId) },
      })
      return data.commentsState as TCommentsState
    },
    enabled: !!community && !!innerId,
    staleTime: 30_000,
  })

export const viewerQueries = {
  articleStates,
  changelogStates,
  articleState,
  commentStates,
  commentSummary,
}
