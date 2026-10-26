import { createFileRoute } from '@tanstack/react-router'

import ReviewBotSettings from '~/unit/ReviewBot/Settings'

export const Route = createFileRoute('/$community/review-bot')({ component: ReviewBotSettingsPage })

function ReviewBotSettingsPage() {
  const { community } = Route.useParams()
  return <ReviewBotSettings community={community} />
}
