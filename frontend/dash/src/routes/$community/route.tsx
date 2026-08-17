import CommunityBoundary from '@dash/components/CommunityBoundary'
import DashboardShell from '@dash/components/DashboardShell'
import RouteError from '@dash/components/RouteError'
import { loadCommunity } from '@dash/server/community'
import { loadLocale } from '@dash/server/locale'
import { validateCommunitySearch } from '@dash/utils/route-search'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

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
  loader: async ({ deps, params }) => {
    const [shell, locale] = await Promise.all([
      loadCommunity({ data: { community: params.community, ...deps } }),
      loadLocale({ data: { lang: deps.lang } }),
    ])

    return { shell, locale }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title:
          loaderData?.shell.dashboard.ogTitle ||
          loaderData?.shell.dashboard.title ||
          'Groupher Dash',
      },
    ],
    styles: loaderData?.shell.themeCssText ? [{ children: loaderData.shell.themeCssText }] : [],
  }),
  component: CommunityLayout,
})

function CommunityLayout() {
  const { shell, locale } = Route.useLoaderData()

  return (
    <CommunityBoundary
      key={shell.community.slug}
      account={shell.account}
      community={shell.community}
      locale={locale}
    >
      <DashboardShell shell={shell}>
        <Outlet />
      </DashboardShell>
    </CommunityBoundary>
  )
}
