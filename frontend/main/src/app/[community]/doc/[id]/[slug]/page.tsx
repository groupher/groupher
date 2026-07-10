import { getDocPublicTree } from '~/app/ssr'
import DocThread from '~/unit/DocThread'

type TProps = {
  params: Promise<{
    community: string
  }>
}

export default async function Page({ params }: TProps) {
  const { community } = await params
  const initialTree = await getDocPublicTree(community)

  return <DocThread initialTree={initialTree} />
}
