import CommunityBoundary from '@community/components/CommunityBoundary'
import CommunityShell from '@community/components/CommunityShell'
import { loadCommunity, loadCommunityRequestContext } from '@community/server/community'
import { projectCommunityHead } from '@community/server/head'
import { loadLocale } from '@community/server/locale'
import { communityPublicPath } from '@community/server/public-path'
import { Outlet, createFileRoute, notFound, redirect, useLoaderData } from '@tanstack/react-router'

import { PaginationDeviceContext } from '~/hooks/usePagiConfig'
import { communityQueries, dsbQueries, wallpaperQueries } from '~/query'

export const Route = createFileRoute('/$community')({
  beforeLoad: async ({ params }) => {
    if (params.community === '.well-known') throw notFound()
    return { requestContext: await loadCommunityRequestContext() }
  },
  loader: async ({ params, context, location }) => {
    const { requestContext } = context
    const [data, locale] = await Promise.all([
      loadCommunity({ data: { community: params.community } }),
      loadLocale({ data: {} }),
    ])
    if (!data) throw notFound()
    await Promise.all([
      context.queryClient.ensureQueryData(
        communityQueries.slug(params.community, () => data.community),
      ),
      context.queryClient.ensureQueryData(dsbQueries.slug(params.community, () => data.dashboard)),
      context.queryClient.ensureQueryData(
        wallpaperQueries.slug(params.community, () => data.wallpaper),
      ),
    ])
    if (
      location.pathname === `/${params.community}` ||
      location.pathname === `/${params.community}/`
    ) {
      throw redirect({
        href: communityPublicPath(params.community, '/post', requestContext.customDomain),
        replace: true,
      })
    }
    if (!data.community.slug) throw notFound()
    return { head: projectCommunityHead(data), locale, requestContext }
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
  const { locale, requestContext } = Route.useLoaderData()
  const { community } = Route.useParams()
  const { renderedAt, theme } = useLoaderData({ from: '__root__' })
  return (
    <CommunityBoundary
      key={community}
      community={community}
      locale={locale}
      initialNow={renderedAt}
      theme={theme}
    >
      <PaginationDeviceContext.Provider value={requestContext.mobilePagination}>
        <CommunityShell>
          <Outlet />
        </CommunityShell>
      </PaginationDeviceContext.Provider>
    </CommunityBoundary>
  )
}
