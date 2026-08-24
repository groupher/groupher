import { createFileRoute } from '@tanstack/react-router'

import AboutThread from '~/unit/AboutThread'

export const Route = createFileRoute('/$community/about')({
  head: ({ params }) => ({
    links: [{ rel: 'canonical', href: `/${params.community}/about` }],
  }),
  component: () => <AboutThread />,
})
