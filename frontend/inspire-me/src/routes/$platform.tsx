import { createFileRoute, notFound } from '@tanstack/react-router'

import FeedbackPage from '../components/FeedbackPage'
import { validateFeedbackSearch } from '../lib/search'
import { loadFeedbackPage } from '../server/feedback'

export const Route = createFileRoute('/$platform')({
  validateSearch: validateFeedbackSearch,
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ deps, params }) => {
    const page = await loadFeedbackPage({ data: { platform: params.platform, ...deps } })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData }) => {
    const selected = loaderData?.selected
    if (!selected) return {}
    const title = `${selected.name} feedback ideas | Inspire Me`
    const description = `Explore ${selected.count.toLocaleString()} public feedback posts from ${selected.name}.`
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
      ],
    }
  },
  component: PlatformPage,
})

function PlatformPage() {
  return <FeedbackPage {...Route.useLoaderData()} />
}
