import CommunityBoundary from '@dash/components/CommunityBoundary'
import { loadCommunity } from '@dash/server/community'
import { loadLocale } from '@dash/server/locale'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community')({
  staleTime: 300_000,
  loader: async ({ location, params }) => {
    const lang = new URLSearchParams(location.search).get('lang') || undefined
    const mode = new URLSearchParams(location.search).get('mode') || undefined

    const [shell, locale] = await Promise.all([
      loadCommunity({ data: { community: params.community, lang, mode } }),
      loadLocale({ data: { lang } }),
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
    <CommunityBoundary key={shell.community.slug} community={shell.community} locale={locale}>
      <Outlet />
    </CommunityBoundary>
  )
}
