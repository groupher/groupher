import { createFileRoute } from '@tanstack/react-router'

import PendingQueue from '~/unit/CMSReview/PendingQueue'

export const Route = createFileRoute('/$community/review-queue')({ component: ReviewQueuePage })

function ReviewQueuePage() {
  const { community } = Route.useParams()
  return <PendingQueue community={community} />
}
