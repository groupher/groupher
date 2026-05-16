import { redirect } from 'next/navigation'

import { DSB_CHANGELOG_ROUTE, DSB_ROUTE } from '~/const/route'

export default async function Page({ params }) {
  const { community } = await params
  redirect(`/${community}/dashboard/${DSB_ROUTE.CHANGELOG}/${DSB_CHANGELOG_ROUTE.CONTENT}`)
}
