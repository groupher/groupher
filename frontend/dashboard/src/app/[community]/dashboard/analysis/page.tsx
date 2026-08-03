import AnalysisWebClient from './Client'
import { fetchAnalysisWebOverview } from './helper'

export default async function AnalysisPage({ params }) {
  const { community } = await params
  const data = await fetchAnalysisWebOverview(community)

  return <AnalysisWebClient data={data} />
}
