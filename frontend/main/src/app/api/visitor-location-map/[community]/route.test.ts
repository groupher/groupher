import { beforeEach, describe, expect, it, vi } from 'vitest'

const { gqFetch } = vi.hoisted(() => ({ gqFetch: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('~/graphql/server', () => ({ gqFetch }))

import { GET } from './route'

const context = { params: Promise.resolve({ community: 'home' }) }

describe('visitor location map route', () => {
  beforeEach(() => gqFetch.mockReset())

  it('rejects arbitrary locale cache variants before querying Phoenix', async () => {
    const response = await GET(
      new Request('https://groupher.com/api/visitor-location-map/home?locale=xx1'),
      context,
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(gqFetch).not.toHaveBeenCalled()
  })

  it('redirects locale aliases to one canonical cache key without querying Phoenix', async () => {
    const response = await GET(
      new Request('https://groupher.com/api/visitor-location-map/home?locale=zh_CN'),
      context,
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://groupher.com/api/visitor-location-map/home?locale=zh',
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(gqFetch).not.toHaveBeenCalled()
  })

  it('uses the normalized community locale and the degraded region cache window', async () => {
    gqFetch.mockResolvedValue(
      Response.json({
        data: {
          analysisVisitorLocationMap: {
            status: 'ok',
            range: { days: 30 },
            countries: [{ code: 'US', visitors: 3, percentage: 100, regions: [] }],
            error: {
              code: 'provider_error',
              message: 'region unavailable',
              section: 'region',
              providerStatus: null,
            },
          },
          community: { dashboard: { baseInfo: { locale: 'zh_CN' } } },
        },
      }),
    )

    const response = await GET(
      new Request('https://groupher.com/api/visitor-location-map/home', {
        headers: { 'x-forwarded-for': '203.0.113.20' },
      }),
      context,
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=60, must-revalidate')
    expect(payload.countries[0].label).toBe('美国')
  })
})
