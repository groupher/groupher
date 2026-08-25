import CommunityBoundary from '@community/components/CommunityBoundary'
import CommunityShell from '@community/components/CommunityShell'
import { communityQueries } from '@community/query/queries'
import { loadCommunityRequestContext } from '@community/server/community'
import { projectCommunityHead } from '@community/server/head'
import { loadLocale } from '@community/server/locale'
import { communityPublicPath } from '@community/server/public-path'
import { Outlet, createFileRoute, notFound, redirect, useLoaderData } from '@tanstack/react-router'

export const Route = createFileRoute('/$community')({
  beforeLoad: ({ params }) => {
    if (params.community === '.well-known') throw notFound()
  },
  loader: async ({ params, context, location }) => {
    const [shell, locale, requestContext] = await Promise.all([
      context.queryClient.ensureQueryData(communityQueries.shell(params.community)),
      loadLocale({ data: {} }),
      loadCommunityRequestContext(),
    ])
    if (!shell) throw notFound()
    if (
      location.pathname === `/${params.community}` ||
      location.pathname === `/${params.community}/`
    ) {
      throw redirect({
        href: communityPublicPath(params.community, '/post', requestContext.customDomain),
        replace: true,
      })
    }
    if (!shell.community.slug) throw notFound()
    return { head: projectCommunityHead(shell), locale, requestContext }
  },
  head: ({ loaderData, matches }) => ({
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
            href: communityPublicPath(loaderData.head.feedSlug, '/feed.xml', matches),
          },
          {
            rel: 'alternate',
            type: 'application/atom+xml',
            href: communityPublicPath(loaderData.head.feedSlug, '/feed.atom', matches),
          },
          {
            rel: 'alternate',
            type: 'application/feed+json',
            href: communityPublicPath(loaderData.head.feedSlug, '/feed.json', matches),
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
