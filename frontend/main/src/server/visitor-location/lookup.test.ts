import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { toVisitorLocationMap } from './lookup'
import { REGION_LOCATION_POINTS } from './visitor-location.generated'

describe('visitor location map projection', () => {
  it('localizes country names and keeps Other out of globe markers', () => {
    const result = toVisitorLocationMap(
      {
        status: 'ok',
        range: { days: 30 },
        countries: [
          { code: 'US', visitors: 9, percentage: 90, regions: [] },
          { code: 'OTHER', visitors: 1, percentage: 10, regions: [] },
        ],
      },
      'zh',
    )

    expect(result.countries.map((country) => country.label)).toEqual(['美国', '其他'])
    expect(result.markers).toHaveLength(1)
    expect(result.markers[0].kind).toBe('country')
  })

  it('falls back to a country marker when selected regions have no generated point', () => {
    const result = toVisitorLocationMap(
      {
        status: 'ok',
        countries: [
          {
            code: 'US',
            visitors: 12,
            percentage: 100,
            regions: [{ code: 'US-NOT-A-REGION', visitors: 12 }],
          },
        ],
      },
      'en',
    )

    expect(result.markers).toHaveLength(1)
    expect(result.markers[0].kind).toBe('country')
  })

  it('caps globe density at 50 markers while retaining every displayed country', () => {
    const countryCodes = ['US', 'CN', 'CA', 'RU', 'BR']
    const countries = countryCodes.map((countryCode, countryIndex) => ({
      code: countryCode,
      visitors: 1_000 - countryIndex * 100,
      percentage: 20,
      regions: Object.keys(REGION_LOCATION_POINTS)
        .filter((code) => code.startsWith(`${countryCode}-`))
        .slice(0, 10)
        .map((code, index) => ({ code, visitors: 40 - index })),
    }))

    const result = toVisitorLocationMap({ status: 'ok', countries }, 'en')

    expect(result.markers).toHaveLength(50)
    expect(result.markers.filter((marker) => marker.kind === 'country')).toHaveLength(5)
  })
})
