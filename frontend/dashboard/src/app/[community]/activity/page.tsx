import Activity from '~/unit/DashboardThread/Activity'

export default async function ActivityPage({ params }) {
  const { community } = await params
  return <Activity community={community} />
}
