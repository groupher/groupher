import { gqFetch } from '~/graphql/server'
import type { TVisitorLocationMap } from '~/spec'

import {
  toVisitorLocationMap,
  type TVisitorLocationGraphQL,
} from '../../../../server/visitor-location/lookup'
import { allowVisitorLocationRequest } from '../../../../server/visitor-location/rate-limit'

const SUPPORTED_LOCALES = new Set(['en', 'zh', 'zh-hant', 'ru', 'es'])
const LOCALE_ALIASES: Record<string, string> = {
  'en-us': 'en',
  'en-gb': 'en',
  'zh-cn': 'zh',
  'zh-sg': 'zh',
  'zh-tw': 'zh-hant',
  'zh-hk': 'zh-hant',
  'ru-ru': 'ru',
  'es-es': 'es',
}

const QUERY = `
  query VisitorLocationMap($community: String!) {
    analysisVisitorLocationMap(community: $community) {
      status
      range { days }
      countries {
        code
        visitors
        percentage
        regions { code visitors }
      }
      error { code message section providerStatus }
    }
    community(slug: $community, incViews: false) {
      dashboard { baseInfo { locale } }
    }
  }
`

type TGraphQLData = {
  analysisVisitorLocationMap?: TVisitorLocationGraphQL | null
  community?: { dashboard?: { baseInfo?: { locale?: string | null } | null } | null } | null
}

type TContext = { params: Promise<{ community: string }> }

const cacheHeaders = (seconds: number) => ({
  'Cache-Control': `public, s-maxage=${seconds}, must-revalidate`,
})

const noStoreHeaders = { 'Cache-Control': 'no-store' }

const clientIp = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown'

const localeFrom = (value: string | null): { locale?: string; alias?: string; invalid?: true } => {
  if (value === null) return {}

  const normalized = value.trim().toLowerCase().replaceAll('_', '-')
  if (SUPPORTED_LOCALES.has(normalized)) return { locale: normalized }
  if (LOCALE_ALIASES[normalized]) return { alias: LOCALE_ALIASES[normalized] }
  return { invalid: true }
}

const unavailable = (message: string): TVisitorLocationMap => ({
  status: 'unavailable',
  days: 30,
  countries: [],
  markers: [],
  error: { code: 'upstream_error', message, section: 'country', providerStatus: null },
})

export const GET = async (request: Request, context: TContext) => {
  const { community } = await context.params
  const url = new URL(request.url)
  const requestedLocale = localeFrom(url.searchParams.get('locale'))

  if (requestedLocale.invalid) {
    return Response.json({ error: 'unsupported locale' }, { status: 400, headers: noStoreHeaders })
  }

  if (requestedLocale.alias) {
    url.searchParams.set('locale', requestedLocale.alias)
    return new Response(null, {
      status: 307,
      headers: { ...noStoreHeaders, Location: url.toString() },
    })
  }

  if (!/^[a-z0-9-]{1,64}$/i.test(community)) {
    return Response.json({ error: 'invalid community' }, { status: 400, headers: noStoreHeaders })
  }

  if (!allowVisitorLocationRequest(clientIp(request), community)) {
    return Response.json(
      { error: 'rate limit exceeded' },
      { status: 429, headers: { ...noStoreHeaders, 'Retry-After': '60' } },
    )
  }

  try {
    const response = await gqFetch(QUERY, { community })
    const envelope = (await response.json()) as {
      data?: TGraphQLData
      errors?: { message?: string }[]
    }

    if (!response.ok || envelope.errors?.length) {
      return Response.json(
        unavailable(envelope.errors?.[0]?.message || 'visitor map unavailable'),
        {
          status: 503,
          headers: cacheHeaders(30),
        },
      )
    }

    const communityLocale = envelope.data?.community?.dashboard?.baseInfo?.locale
    const normalizedCommunityLocale = localeFrom(communityLocale ?? null)
    const locale =
      requestedLocale.locale ||
      normalizedCommunityLocale.locale ||
      normalizedCommunityLocale.alias ||
      'en'
    const result = toVisitorLocationMap(envelope.data?.analysisVisitorLocationMap, locale)
    const degraded = result.status === 'ok' && result.error?.section === 'region'
    const maxAge = result.status === 'unavailable' ? 30 : degraded ? 60 : 300

    return Response.json(result, { headers: cacheHeaders(maxAge) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'visitor map unavailable'
    return Response.json(unavailable(message), { status: 503, headers: cacheHeaders(30) })
  }
}
