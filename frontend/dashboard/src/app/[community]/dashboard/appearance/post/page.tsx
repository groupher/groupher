import { redirect } from 'next/navigation'

import { DSB_POST_ROUTE, DSB_ROUTE } from '~/const/route'

export default async function Page({ params }) {
  const { community } = await params
  redirect(`/${community}/dashboard/${DSB_ROUTE.POST}/${DSB_POST_ROUTE.LAYOUT}`)
}
