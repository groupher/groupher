import InfoLayout from '@dash/components/layouts/InfoLayout'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/info')({
  component: InfoPage,
})

function InfoPage() {
  return (
    <InfoLayout>
      <Outlet />
    </InfoLayout>
  )
}
