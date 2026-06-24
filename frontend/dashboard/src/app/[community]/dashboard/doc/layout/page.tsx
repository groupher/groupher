import { redirect } from 'next/navigation'

import { DSB_DOC_LAYOUT_ROUTE, DSB_DOC_ROUTE, DSB_ROUTE } from '~/const/route'

export default async function DashboardDocLayoutPage({ params }) {
  const { community } = await params

  redirect(
    `/${community}/dashboard/${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.LAYOUT}/${DSB_DOC_LAYOUT_ROUTE.COVER}`,
  )
}
