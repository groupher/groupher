import { notFound } from 'next/navigation'

import { getFeedbackPlatforms } from '../lib/feedback'
import { FeedbackPage } from '../widgets/FeedbackPage'

export async function generateStaticParams() {
  const platforms = await getFeedbackPlatforms()

  return platforms.map((platform) => ({ platform: platform.id }))
}

export default async function Page({ params }: { params: Promise<{ platform: string }> }) {
  const { platform: platformId } = await params
  const platforms = await getFeedbackPlatforms()
  const selected = platforms.find((platform) => platform.id === platformId)

  if (!selected) notFound()

  return <FeedbackPage platforms={platforms} selected={selected} />
}
