import { createFileRoute } from '@tanstack/react-router'

import Drawer from '~/unit/DsbThread/Widgets/Drawer'
import WidgetPreviewLoader from '~/unit/DsbThread/Widgets/PreviewLoader'

export const Route = createFileRoute('/$community/widgets/')({
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
