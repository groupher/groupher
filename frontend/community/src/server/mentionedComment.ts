import { createServerFn } from '@tanstack/react-start'

import type { MentionsGraphNodeStatus } from '~/lib/graphql/generated/graphql'
import { mentionsGraphPage } from '~/query/mentionsGraph'

import { fetchGraphQL, getAuthToken, setPrivateCacheHeader } from './graphql'

type MentionedComment = {
  innerId: string
  status: MentionsGraphNodeStatus
  title: string | null
  html: string | null
}

const mentionedCommentQuery = `
  query MentionedComment($community: String!, $locator: MentionsGraphLocatorInput!) {
    mentionedComment(community: $community, locator: $locator) {
      innerId
      body { html }
    }
  }
`

/** Loads only the Comment selected by a graph link, keeping the parent body closed. */
export const loadMentionedComment = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; articleId: string; commentInnerId: string }) => data)
  .handler(async ({ data }): Promise<MentionedComment | null> => {
    setPrivateCacheHeader()
    const locator: {
      type: 'COMMENT'
      articleId?: string
      articleInnerId?: string
      commentInnerId: string
    } = {
      type: 'COMMENT',
      ...(data.articleId.includes('-')
        ? { articleId: data.articleId }
        : { articleInnerId: data.articleId }),
      commentInnerId: data.commentInnerId,
    }

    const graph = await fetchGraphQL<{
      mentionsGraph: {
        nodes: Array<{
          id: string
          status: MentionedComment['status']
          title: string | null
          locator: typeof locator | null
        }>
        edges: Array<{ from: string; to: string }>
      }
    }>(mentionsGraphPage, {
      community: data.community,
      focus: locator,
      first: 1,
    }).catch(() => null)

    const node = graph?.data?.mentionsGraph.nodes.find(
      (item) =>
        item.locator?.type === 'COMMENT' &&
        item.locator?.commentInnerId === data.commentInnerId &&
        item.locator?.articleId === (locator.articleId ?? null) &&
        item.locator?.articleInnerId === (locator.articleInnerId ?? null),
    )
    if (
      !node ||
      !graph?.data?.mentionsGraph.edges.some((edge) => edge.from === node.id || edge.to === node.id)
    ) {
      return null
    }

    const result = await fetchGraphQL<{
      mentionedComment: { innerId: string; body: { html: string } } | null
    }>(mentionedCommentQuery, { community: data.community, locator }, getAuthToken()).catch(
      () => null,
    )

    return {
      innerId: data.commentInnerId,
      status: node.status,
      title: node.title,
      html: result?.data?.mentionedComment?.body.html ?? null,
    }
  })
