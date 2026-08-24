import { createFileRoute } from '@tanstack/react-router'

import DocThread from '~/unit/DocThread'

export const Route = createFileRoute('/$community/doc/')({
  head: ({ params }) => ({
    links: [{ rel: 'canonical', href: `/${params.community}/doc` }],
  }),
  component: () => <DocThread />,
})
