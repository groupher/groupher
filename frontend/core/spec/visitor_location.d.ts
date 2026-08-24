export type TVisitorLocationMarker = {
  location: [number, number]
  size: number
  kind: 'country' | 'region'
  opacity: number
}

export type TVisitorLocationCountry = {
  code: string
  label: string
  visitors: number
  percentage: number
}

export type TVisitorLocationMap = {
  status: 'ok' | 'unavailable'
  days: number
  countries: TVisitorLocationCountry[]
  markers: TVisitorLocationMarker[]
  error?: {
    code: string | null
    message: string | null
    section: string | null
    providerStatus: string | null
  } | null
}
