import { redirect } from 'next/navigation'

import { DSB_KANBAN_ROUTE, DSB_ROUTE } from '~/const/route'

export default async function Page({ params }) {
  const { community } = await params
  redirect(`/${community}/dashboard/${DSB_ROUTE.KANBAN}/${DSB_KANBAN_ROUTE.CONTENT}`)
}
