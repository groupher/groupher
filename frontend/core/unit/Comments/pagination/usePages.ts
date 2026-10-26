import { useQueries } from '@tanstack/react-query'

import useViewingArticle from '~/hooks/useViewingArticle'
import { gatherCommentViewerIds, mergeCommentViewerState } from '~/lib/commentViewerState'
import { Q } from '~/query'
import { articlePathKey } from '~/query/articlePath'
import type { TCommentCollection, TCommentPage } from '~/query/commentPage'
import {
  readCommentReactionReceipts,
  overlayCommentReactionReceipt,
} from '~/query/mutation/commentReactionReceipt'
import { readCommentFeedReceipts } from '~/query/mutation/commentReceipt'
import type { TComment } from '~/spec'
import useAccount from '~/stores/account/hooks'

import { overlayCommentFeed } from './overlay'

/** Viewer reads retain page boundaries when the cursor collection grows. */
export default function useCommentPages(
  pages: readonly TCommentPage[],
  collection: TCommentCollection,
) {
  const account = useAccount()
  const accountScope = account.accountScope || ''
  const { stats } = useViewingArticle()
  // Reading the revision makes persisted receipts observable after confirmed writes.
  void stats?.snapshotAt
  const articleKey = articlePathKey(collection.article)
  const viewers = useQueries({
    queries: pages.map((page) =>
      Q.viewer.commentStates(
        accountScope,
        collection.article,
        gatherCommentViewerIds({ entries: [...page.pinnedEntries, ...page.entries] }),
      ),
    ),
  })
  const receipts = readCommentFeedReceipts(accountScope, articleKey)
  const reactions = new Map(
    readCommentReactionReceipts(accountScope, articleKey).map((receipt) => [
      receipt.commentRef,
      receipt,
    ]),
  )
  const seen = new Set<string>()
  return pages.map((page, index) => {
    const head =
      index === 0 &&
      (page.pageInfo.api === 'offset' ? page.pageInfo.page === 1 : !collection.initialAfter)
    const projected = overlayCommentFeed(page, collection, receipts, head)
    const decorate = (comment: TComment): TComment => {
      const receipt = reactions.get(String(comment.innerId))
      const next = {
        ...comment,
        replies: comment.replies?.map(decorate),
        replyToComment: comment.replyToComment ? decorate(comment.replyToComment) : null,
      }
      const newer =
        receipt &&
        (typeof comment.commentInteractionRevision !== 'number' ||
          typeof receipt.publicProjection.commentInteractionRevision !== 'number' ||
          comment.commentInteractionRevision < receipt.publicProjection.commentInteractionRevision)
      return mergeCommentViewerState(
        newer ? overlayCommentReactionReceipt(next, receipt) : next,
        viewers[index]?.data || {},
      )
    }
    const unique = (entries: TComment[]) =>
      entries
        .filter((entry) => {
          const key = String(entry.innerId)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map(decorate)
    return {
      ...projected,
      pinnedEntries: unique(projected.pinnedEntries),
      entries: unique(projected.entries),
    }
  })
}
