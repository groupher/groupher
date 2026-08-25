import { communityPublicPath } from '@community/server/public-path'
import { createFileRoute } from '@tanstack/react-router'

import AboutThread from '~/unit/AboutThread'

export const Route = createFileRoute('/$community/about')({
  head: ({ params, matches }) => ({
    links: [{ rel: 'canonical', href: communityPublicPath(params.community, '/about', matches) }],
  }),
  component: () => <AboutThread />,
})
