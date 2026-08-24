import CommunityBoundary from '@community/components/CommunityBoundary'
import CommunityShell from '@community/components/CommunityShell'
import { communityQueries } from '@community/query/queries'
import { projectCommunityHead } from '@community/server/head'
import { loadLocale } from '@community/server/locale'
import { Outlet, createFileRoute, notFound, useLoaderData } from '@tanstack/react-router'

export const Route = createFileRoute('/$community')({
  beforeLoad: ({ params, location }) => {
    const communityRoot = `/${params.community}`
    if (
      params.community === '.well-known' ||
      location.pathname === communityRoot ||
      location.pathname === `${communityRoot}/`
    ) {
      throw notFound()
    }
  },
  loader: async ({ params, context }) => {
    const [shell, locale] = await Promise.all([
      context.queryClient.ensureQueryData(communityQueries.shell(params.community)),
      loadLocale({ data: {} }),
    ])
    if (!shell.community.slug) throw notFound()
    return { head: projectCommunityHead(shell), locale }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.head.title || 'Groupher Community',
      },
      ...(loaderData?.head.description
        ? [{ name: 'description', content: loaderData.head.description }]
        : []),
      ...(loaderData?.head.ogSiteName
        ? [{ property: 'og:site_name', content: loaderData.head.ogSiteName }]
        : []),
      ...(loaderData?.head.ogImage
        ? [{ property: 'og:image', content: loaderData.head.ogImage }]
        : []),
      ...(loaderData?.head.twitterCard
        ? [{ name: 'twitter:card', content: loaderData.head.twitterCard }]
        : []),
      ...(loaderData?.head.twitterSite
        ? [{ name: 'twitter:site', content: loaderData.head.twitterSite }]
        : []),
      ...(loaderData?.head.twitterImage
        ? [{ name: 'twitter:image', content: loaderData.head.twitterImage }]
        : []),
      ...(loaderData?.head.noIndex ? [{ name: 'robots', content: 'noindex' }] : []),
    ],
    links: loaderData?.head.feedSlug
      ? [
          {
            rel: 'alternate',
            type: 'application/rss+xml',
            href: `/${loaderData.head.feedSlug}/feed.xml`,
          },
          {
            rel: 'alternate',
            type: 'application/atom+xml',
            href: `/${loaderData.head.feedSlug}/feed.atom`,
          },
          {
            rel: 'alternate',
            type: 'application/feed+json',
            href: `/${loaderData.head.feedSlug}/feed.json`,
          },
        ]
      : [],
    styles: loaderData?.head.themeCssText ? [{ children: loaderData.head.themeCssText }] : [],
  }),
  component: CommunityLayout,
})

function CommunityLayout() {
  const { locale } = Route.useLoaderData()
  const { community } = Route.useParams()
  const { renderedAt } = useLoaderData({ from: '__root__' })
  return (
    <CommunityBoundary
      key={community}
      community={community}
      locale={locale}
      initialNow={renderedAt}
    >
      <CommunityShell>
        <Outlet />
      </CommunityShell>
    </CommunityBoundary>
  )
}
