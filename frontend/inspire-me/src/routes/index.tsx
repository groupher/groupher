import { createFileRoute, notFound } from '@tanstack/react-router'

import FeedbackPage from '../components/FeedbackPage'
import { validateFeedbackSearch } from '../lib/search'
import { loadFeedbackPage } from '../server/feedback'

export const Route = createFileRoute('/')({
  validateSearch: validateFeedbackSearch,
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ deps }) => {
    const page = await loadFeedbackPage({ data: deps })
    if (!page) throw notFound()
    return page
  },
  component: IndexPage,
})

function IndexPage() {
  return <FeedbackPage {...Route.useLoaderData()} />
}
