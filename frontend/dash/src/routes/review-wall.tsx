import { createFileRoute } from '@tanstack/react-router'

import AlertWall from '~/unit/AlertWall'

export const Route = createFileRoute('/review-wall')({ component: PlatformAlertWallPage })

function PlatformAlertWallPage() {
  return <AlertWall />
}
