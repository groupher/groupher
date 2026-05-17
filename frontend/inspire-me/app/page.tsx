import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getFeedbackPlatforms } from './lib/feedback'
import { clampPage } from './lib/pagination'
import { FeedbackPage, POSTS_PER_PAGE } from './widgets/FeedbackPage'

export const metadata: Metadata = {
  title: 'Inspire Me | Feedback platform ideas',
  description: 'Explore public feedback posts from product feedback platforms.',
}

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [{ page }, platforms] = await Promise.all([searchParams, getFeedbackPlatforms()])
  const selected = platforms[0]

  if (!selected) notFound()

  const totalPages = Math.max(1, Math.ceil(selected.posts.length / POSTS_PER_PAGE))
  const currentPage = clampPage(page, totalPages)
  const rankOffset = (currentPage - 1) * POSTS_PER_PAGE
  const posts = selected.posts.slice(rankOffset, rankOffset + POSTS_PER_PAGE)

  return (
    <FeedbackPage
      platforms={platforms}
      selected={selected}
      currentPage={currentPage}
      totalPages={totalPages}
      rankOffset={rankOffset}
      posts={posts}
    />
  )
}
