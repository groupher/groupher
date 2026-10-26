import { createFileRoute } from '@tanstack/react-router'

import AlertWall from '~/unit/AlertWall'

export const Route = createFileRoute('/$community/review')({ component: ReviewBoardPage })

function ReviewBoardPage() {
  const { community } = Route.useParams()
  return <AlertWall community={community} />
}
