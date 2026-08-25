import { communityPublicPath } from '@community/server/public-path'
import { createFileRoute } from '@tanstack/react-router'

import DocThread from '~/unit/DocThread'

export const Route = createFileRoute('/$community/doc/')({
  head: ({ params, matches }) => ({
    links: [{ rel: 'canonical', href: communityPublicPath(params.community, '/doc', matches) }],
  }),
  component: () => <DocThread />,
})
