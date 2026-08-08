import DashboardShell from '@dash/components/DashboardShell'
import RouteError from '@dash/components/RouteError'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { Route as CommunityRoute } from '../route'

export const Route = createFileRoute('/$community/dash')({
  errorComponent: RouteError,
  beforeLoad: ({ params, location }) => {
    const pathname = location.pathname
    const isOverview = pathname === `/${params.community}/dash/overview`
    const isDashRoot =
      pathname === `/${params.community}/dash` || pathname === `/${params.community}/dash/`

    if (isOverview) {
      return
    }

    if (isDashRoot) {
      throw redirect({
        to: '/$community/dash/overview',
        params: true,
      })
    }

    // Keep child dashboard routes untouched (e.g. /:community/dash/doc/editor).
    return
  },
  component: DsbLayout,
})

function DsbLayout() {
  const { shell } = CommunityRoute.useLoaderData()

  return (
    <DashboardShell shell={shell}>
      <Outlet />
    </DashboardShell>
  )
}
