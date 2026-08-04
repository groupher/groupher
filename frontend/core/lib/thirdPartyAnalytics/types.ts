export type TThirdPartyAnalyticsProvider = 'ga' | 'gtm' | 'clarity' | 'plausible' | 'fathom'

export type TThirdPartyAnalyticsConfig = {
  provider: TThirdPartyAnalyticsProvider
  enabled: boolean
  measurementId?: string | null
  containerId?: string | null
  projectId?: string | null
  domain?: string | null
  siteId?: string | null
}

export type TThirdPartyAnalyticsField =
  | 'measurementId'
  | 'containerId'
  | 'projectId'
  | 'domain'
  | 'siteId'
