import { createFileRoute } from '@tanstack/react-router'

import Drawer from '~/unit/DashboardThread/Widgets/Drawer'
import WidgetPreviewLoader from '~/unit/DashboardThread/Widgets/PreviewLoader'

export const Route = createFileRoute('/$community/dash/widgets/')({
  component: WidgetsIndexPage,
})

function WidgetsIndexPage() {
  const { community } = Route.useParams()

  return (
    <>
      <Drawer />
      <WidgetPreviewLoader community={community} />
    </>
  )
}
