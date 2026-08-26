import type { FeedbackPlatform, FeedbackPlatformSummary, FeedbackPost } from './feedback'
import { clampPage } from './pagination'

export const POSTS_PER_PAGE = 500

export type FeedbackPageData = {
  platforms: FeedbackPlatformSummary[]
  selected: FeedbackPlatform
  currentPage: number
  totalPages: number
  rankOffset: number
  posts: FeedbackPost[]
}

/** Projects one platform and a tolerant page parameter into the page view model. */
export function makeFeedbackPageData(
  platforms: FeedbackPlatformSummary[],
  selected: FeedbackPlatform,
  page: string | undefined,
): FeedbackPageData {
  const totalPages = Math.max(1, Math.ceil(selected.posts.length / POSTS_PER_PAGE))
  const currentPage = clampPage(page, totalPages)
  const rankOffset = (currentPage - 1) * POSTS_PER_PAGE

  return {
    platforms,
    selected,
    currentPage,
    totalPages,
    rankOffset,
    posts: selected.posts.slice(rankOffset, rankOffset + POSTS_PER_PAGE),
  }
}
