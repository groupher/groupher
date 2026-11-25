import CommunityBoundary from '@dash/components/CommunityBoundary'
import DsbShell from '@dash/components/DsbShell'
import RouteError from '@dash/components/RouteError'
import { loadCommunity } from '@dash/server/community'
import { loadLocale } from '@dash/server/locale'
import { validateCommunitySearch } from '@dash/utils/route-search'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { communityQueries, dsbQueries, wallpaperQueries } from '~/query'

export const Route = createFileRoute('/$community')({
  staleTime: 300_000,
  errorComponent: RouteError,
  validateSearch: validateCommunitySearch,
  loaderDeps: ({ search }) => ({
    lang: search.lang,
    mode: search.mode,
  }),
  beforeLoad: ({ params, location }) => {
    const pathname = location.pathname
    const communityRoot = `/${params.community}`

    if (pathname === communityRoot || pathname === `${communityRoot}/`) {
      throw redirect({
        to: '/$community/overview',
        params: true,
      })
    }
  },
  loader: async ({ context, deps, params }) => {
    const communityPromise = loadCommunity({ data: { community: params.community, ...deps } })
    const localePromise = deps.lang
      ? loadLocale({ data: { lang: deps.lang, routeOverride: true } })
      : null
    const [data, routeLocale] = await Promise.all([
      communityPromise,
      localePromise ?? Promise.resolve(null),
    ])

    const [locale] = await Promise.all([
      routeLocale ?? loadLocale({ data: { lang: data.dashboard.locale, routeOverride: false } }),
      context.queryClient.ensureQueryData(
        communityQueries.slug(params.community, () => data.community),
      ),
      context.queryClient.ensureQueryData(dsbQueries.slug(params.community, () => data.dashboard)),
      context.queryClient.ensureQueryData(
        wallpaperQueries.slug(params.community, () => data.wallpaper),
      ),
    ])

    return {
      data: {
        account: data.account,
        community: params.community,
        demoMode: data.demoMode,
      },
      head: {
        title: data.dashboard.ogTitle || data.dashboard.title || 'Groupher Dash',
        themeCssText: data.themeCssText,
      },
      locale,
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.head.title || 'Groupher Dash',
      },
    ],
    styles: loaderData?.head.themeCssText ? [{ children: loaderData.head.themeCssText }] : [],
  }),
  component: CommunityLayout,
})

function CommunityLayout() {
  const { data, locale } = Route.useLoaderData()

  return (
    <CommunityBoundary
      key={data.community}
      account={data.account}
      community={data.community}
      locale={locale}
    >
      <DsbShell data={data}>
        <Outlet />
      </DsbShell>
    </CommunityBoundary>
  )
}
