import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Route } from './route'

const mocks = vi.hoisted(() => ({
  loadCommunity: vi.fn(),
  loadLocale: vi.fn(),
}))

vi.mock('@dash/server/community', () => ({ loadCommunity: mocks.loadCommunity }))
vi.mock('@dash/server/locale', () => ({ loadLocale: mocks.loadLocale }))
vi.mock('@dash/components/CommunityBoundary', () => ({ default: () => null }))
vi.mock('@dash/components/DsbShell', () => ({ default: () => null }))
vi.mock('@dash/components/RouteError', () => ({ default: () => null }))

const communityData = {
  account: { loading: false, user: null },
  community: { slug: 'home' },
  dashboard: { locale: 'en', title: 'Home', ogTitle: null },
  wallpaper: {},
  themeCssText: '',
  demoMode: false,
}

describe('Dash community route loader', () => {
  beforeEach(() => {
    mocks.loadCommunity.mockReset()
    mocks.loadLocale.mockReset()
    mocks.loadLocale.mockImplementation(async ({ data }) => ({ locale: data.lang }))
  })

  it('starts an explicit locale load before the community request resolves', async () => {
    let resolveCommunity: ((data: typeof communityData) => void) | undefined
    mocks.loadCommunity.mockReturnValue(
      new Promise((resolve) => {
        resolveCommunity = resolve
      }),
    )
    const queryClient = new QueryClient()
    const load = Route.options.loader as unknown as (input: {
      context: { queryClient: QueryClient }
      deps: { lang?: string; mode?: string }
      params: { community: string }
    }) => Promise<{ locale: { locale: string } }>

    const resultPromise = load({
      context: { queryClient },
      deps: { lang: 'zh' },
      params: { community: 'home' },
    })

    expect(mocks.loadLocale).toHaveBeenCalledWith({
      data: { lang: 'zh', routeOverride: true },
    })
    resolveCommunity?.(communityData)
    await expect(resultPromise).resolves.toMatchObject({ locale: { locale: 'zh' } })
  })

  it('observes an explicit locale failure while the community request is pending', async () => {
    mocks.loadCommunity.mockReturnValue(new Promise(() => undefined))
    mocks.loadLocale.mockRejectedValue(new Error('locale load failed'))
    const load = Route.options.loader as unknown as (input: {
      context: { queryClient: QueryClient }
      deps: { lang?: string; mode?: string }
      params: { community: string }
    }) => Promise<unknown>

    const resultPromise = load({
      context: { queryClient: new QueryClient() },
      deps: { lang: 'zh' },
      params: { community: 'home' },
    })

    await expect(resultPromise).rejects.toThrow('locale load failed')
  })

  it('loads the dashboard locale after community data when there is no route override', async () => {
    mocks.loadCommunity.mockResolvedValue(communityData)
    const load = Route.options.loader as unknown as (input: {
      context: { queryClient: QueryClient }
      deps: { lang?: string; mode?: string }
      params: { community: string }
    }) => Promise<{ locale: { locale: string } }>

    await load({
      context: { queryClient: new QueryClient() },
      deps: {},
      params: { community: 'home' },
    })

    expect(mocks.loadLocale).toHaveBeenCalledWith({
      data: { lang: 'en', routeOverride: false },
    })
  })
})
