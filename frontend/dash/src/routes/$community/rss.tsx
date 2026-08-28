import { createFileRoute } from '@tanstack/react-router'

import RSS from '~/unit/DsbThread/RSS'

export const Route = createFileRoute('/$community/rss')({
  component: RssPage,
})

function RssPage() {
  return <RSS />
}
