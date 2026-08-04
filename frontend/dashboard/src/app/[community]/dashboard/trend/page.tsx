import TrendClient from './Client'

export default async function TrendPage({ params }) {
  const { community } = await params

  return <TrendClient community={community} />
}
