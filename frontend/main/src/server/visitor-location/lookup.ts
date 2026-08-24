import 'server-only'
import type { TVisitorLocationMap, TVisitorLocationMarker } from '~/spec'

import { COUNTRY_LOCATION_POINTS, REGION_LOCATION_POINTS } from './visitor-location.generated'

type TGraphQLError = TVisitorLocationMap['error']

type TRegion = {
  code?: string | null
  visitors?: number | null
}

type TCountry = {
  code?: string | null
  visitors?: number | null
  percentage?: number | null
  regions?: TRegion[] | null
}

export type TVisitorLocationGraphQL = {
  status?: string | null
  range?: { days?: number | null } | null
  countries?: TCountry[] | null
  error?: TGraphQLError
}

type TInternalMarker = TVisitorLocationMarker & {
  countryCode: string
  visitors: number
}

const MAX_MARKERS = 50

const OTHER_LABELS: Record<string, string> = {
  en: 'Other',
  zh: '其他',
  'zh-hant': '其他',
  ru: 'Другие',
  es: 'Otros',
}

const countryName = (code: string, locale: string): string => {
  const source = COUNTRY_LOCATION_POINTS[code as keyof typeof COUNTRY_LOCATION_POINTS]
  if (!source) return code

  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || source.name
  } catch {
    return source.name
  }
}

const markerSize = (visitors: number, maxVisitors: number, kind: 'country' | 'region') => {
  const ratio = Math.sqrt(visitors / Math.max(maxVisitors, 1))
  return kind === 'region' ? 0.035 + ratio * 0.065 : 0.065 + ratio * 0.115
}

const markerFor = (
  code: string,
  visitors: number,
  countryCode: string,
  kind: 'country' | 'region',
  maxVisitors: number,
): TInternalMarker | null => {
  const point =
    kind === 'region'
      ? REGION_LOCATION_POINTS[code as keyof typeof REGION_LOCATION_POINTS]
      : COUNTRY_LOCATION_POINTS[code as keyof typeof COUNTRY_LOCATION_POINTS]
  if (!point || visitors <= 0) return null

  return {
    countryCode,
    visitors,
    location: [...point.location] as [number, number],
    size: markerSize(visitors, maxVisitors, kind),
    kind,
    opacity: kind === 'region' ? 0.9 : 0.72,
  }
}

const selectMarkers = (markers: TInternalMarker[]): TVisitorLocationMarker[] => {
  if (markers.length <= MAX_MARKERS) return markers.map(stripPrivateMarkerFields)

  const required = new Map<string, TInternalMarker>()
  for (const marker of markers) {
    const current = required.get(marker.countryCode)
    if (!current || marker.visitors > current.visitors) required.set(marker.countryCode, marker)
  }

  const requiredSet = new Set(required.values())
  const rest = markers
    .filter((marker) => !requiredSet.has(marker))
    .sort((a, b) => b.visitors - a.visitors)

  return [...required.values(), ...rest].slice(0, MAX_MARKERS).map(stripPrivateMarkerFields)
}

const stripPrivateMarkerFields = ({
  countryCode: _countryCode,
  visitors: _visitors,
  ...marker
}: TInternalMarker) => marker

export const toVisitorLocationMap = (
  payload: TVisitorLocationGraphQL | null | undefined,
  locale: string,
): TVisitorLocationMap => {
  const rows = payload?.countries ?? []
  const visibleCountries = rows.filter((country) => country.code && country.code !== 'OTHER')
  const maxVisitors = Math.max(...visibleCountries.map((country) => country.visitors ?? 0), 1)
  const markers: TInternalMarker[] = []

  for (const country of visibleCountries) {
    const countryCode = country.code as string
    const countryVisitors = Math.max(country.visitors ?? 0, 0)
    const regionMarkers = (country.regions ?? [])
      .map((region) =>
        region.code
          ? markerFor(region.code, region.visitors ?? 0, countryCode, 'region', maxVisitors)
          : null,
      )
      .filter((marker): marker is TInternalMarker => marker !== null)

    if (regionMarkers.length === 0) {
      const countryMarker = markerFor(
        countryCode,
        countryVisitors,
        countryCode,
        'country',
        maxVisitors,
      )
      if (countryMarker) markers.push(countryMarker)
      continue
    }

    markers.push(...regionMarkers)
    const remainder = Math.max(
      countryVisitors - regionMarkers.reduce((sum, marker) => sum + marker.visitors, 0),
      0,
    )
    const fallback = markerFor(countryCode, remainder, countryCode, 'country', maxVisitors)
    if (fallback) markers.push(fallback)
  }

  return {
    status: payload?.status === 'ok' ? 'ok' : 'unavailable',
    days: payload?.range?.days ?? 30,
    countries: rows.map((country) => {
      const code = country.code || 'OTHER'
      return {
        code,
        label:
          code === 'OTHER' ? (OTHER_LABELS[locale] ?? OTHER_LABELS.en) : countryName(code, locale),
        visitors: country.visitors ?? 0,
        percentage: country.percentage ?? 0,
      }
    }),
    markers: selectMarkers(markers),
    error: payload?.error ?? null,
  }
}
