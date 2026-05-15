import { redirect } from 'next/navigation'

export default async function Page({ params }) {
  const { community } = await params
  redirect(`/${community}/dashboard/doc/layout`)
}
