import WebAnalysisClient from './Client'
import { fetchWebAnalysisSummary } from './helper'

export default async function AnalysisPage({ params }) {
  const { community } = await params
  const data = await fetchWebAnalysisSummary(community)

  return <WebAnalysisClient data={data} />
}
