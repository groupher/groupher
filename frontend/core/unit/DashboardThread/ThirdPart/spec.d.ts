import type {
  TThirdPartyAnalyticsField,
  TThirdPartyAnalyticsProvider,
} from '~/lib/thirdPartyAnalytics'
import type { TTransKey } from '~/spec'

export type TThirdPartyAnalyticsProviderField = {
  key: TThirdPartyAnalyticsField
  label: TTransKey
  desc: TTransKey
  placeholder: TTransKey
  requiredWhenEnabled: boolean
  pattern: string
}

export type TIntegrateAnalysisTool = {
  provider: TThirdPartyAnalyticsProvider
  title: TTransKey
  desc: TTransKey
  detail: TTransKey
  docsUrl: string
  icon: string
  identityField: TThirdPartyAnalyticsField
  configFields: readonly TThirdPartyAnalyticsProviderField[]
}

export type TIntegrateAnalysisToolKey = TIntegrateAnalysisTool['provider']
