import { connection } from 'next/server'

import WebOverview from '~/unit/DashboardThread/Analysis/WebOverview'

import { fetchAnalysisWebOverview } from './helper'

export default async function TrendPage({ params }) {
  await connection()

  const { community } = await params
  const data = await fetchAnalysisWebOverview(community)

  return <WebOverview data={data} />
}
