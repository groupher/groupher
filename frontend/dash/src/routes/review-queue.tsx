import { createFileRoute } from '@tanstack/react-router'

import PendingQueue from '~/unit/CMSReview/PendingQueue'

export const Route = createFileRoute('/review-queue')({ component: PlatformReviewQueuePage })

function PlatformReviewQueuePage() {
  return <PendingQueue />
}
