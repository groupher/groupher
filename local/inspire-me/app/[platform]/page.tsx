import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getFeedbackPlatforms } from '../lib/feedback'
import { clampPage } from '../lib/pagination'
import { FeedbackPage, POSTS_PER_PAGE } from '../widgets/FeedbackPage'

export async function generateStaticParams() {
  const platforms = await getFeedbackPlatforms()

  return platforms.map((platform) => ({ platform: platform.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>
}): Promise<Metadata> {
  const [{ platform: platformId }, platforms] = await Promise.all([params, getFeedbackPlatforms()])
  const selected = platforms.find((platform) => platform.id === platformId)

  if (!selected) return {}

  const title = `${selected.name} feedback ideas | Inspire Me`
  const description = `Explore ${selected.count.toLocaleString()} public feedback posts from ${selected.name}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const [{ platform: platformId }, { page }, platforms] = await Promise.all([
    params,
    searchParams,
    getFeedbackPlatforms(),
  ])
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
