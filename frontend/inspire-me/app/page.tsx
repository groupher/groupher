import { getFeedbackPlatforms } from './lib/feedback'
import { FeedbackPage } from './widgets/FeedbackPage'

export default async function Page() {
  const platforms = await getFeedbackPlatforms()
  const selected = platforms[0]

  return <FeedbackPage platforms={platforms} selected={selected} />
}
