import { notFound } from 'next/navigation'

import { getFeedbackPlatforms } from '../lib/feedback'
import { FeedbackPage, POSTS_PER_PAGE } from '../widgets/FeedbackPage'

export async function generateStaticParams() {
  const platforms = await getFeedbackPlatforms()

  return platforms.map((platform) => ({ platform: platform.id }))
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { platform: platformId } = await params
  const { page } = await searchParams
  const platforms = await getFeedbackPlatforms()
  const selected = platforms.find((platform) => platform.id === platformId)

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

function clampPage(page: string | undefined, totalPages: number): number {
  const value = Number.parseInt(page ?? '1', 10)
  if (!Number.isFinite(value)) return 1

  return Math.min(Math.max(value, 1), totalPages)
}
