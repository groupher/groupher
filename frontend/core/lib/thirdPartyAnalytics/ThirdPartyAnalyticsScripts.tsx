import { Fragment, type ReactNode } from 'react'

import { Script } from '~/platform'

import { getRenderableThirdPartyAnalyticsConfigs, getThirdPartyAnalyticsValue } from './index'
import type { TThirdPartyAnalyticsConfig, TThirdPartyAnalyticsProvider } from './types'

type TProps = {
  configs?: readonly TThirdPartyAnalyticsConfig[] | null
}

type TScriptRenderer = (config: TThirdPartyAnalyticsConfig) => ReactNode

const jsString = (value: string): string => JSON.stringify(value)

const googleAnalyticsInit = (measurementId: string): string => `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', ${jsString(measurementId)});
`

const googleTagManagerInit = (containerId: string): string => `
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer',${jsString(containerId)});
`

const clarityInit = (projectId: string): string => `
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", ${jsString(projectId)});
`

const renderGoogleAnalytics: TScriptRenderer = (config) => {
  const value = getThirdPartyAnalyticsValue(config)

  return (
    <Fragment key={config.provider}>
      <Script
        id='third-party-analytics-ga-loader'
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(value)}`}
        strategy='mount'
      />
      <Script
        id='third-party-analytics-ga-init'
        strategy='mount'
        dangerouslySetInnerHTML={{ __html: googleAnalyticsInit(value) }}
      />
    </Fragment>
  )
}

const renderGoogleTagManager: TScriptRenderer = (config) => (
  <Script
    key={config.provider}
    id='third-party-analytics-gtm'
    strategy='mount'
    dangerouslySetInnerHTML={{ __html: googleTagManagerInit(getThirdPartyAnalyticsValue(config)) }}
  />
)

const renderClarity: TScriptRenderer = (config) => (
  <Script
    key={config.provider}
    id='third-party-analytics-clarity'
    strategy='mount'
    dangerouslySetInnerHTML={{ __html: clarityInit(getThirdPartyAnalyticsValue(config)) }}
  />
)

const renderPlausible: TScriptRenderer = (config) => (
  <Script
    key={config.provider}
    id='third-party-analytics-plausible'
    src='https://plausible.io/js/script.js'
    data-domain={getThirdPartyAnalyticsValue(config)}
    strategy='idle'
  />
)

const renderFathom: TScriptRenderer = (config) => (
  <Script
    key={config.provider}
    id='third-party-analytics-fathom'
    src='https://cdn.usefathom.com/script.js'
    data-site={getThirdPartyAnalyticsValue(config)}
    strategy='idle'
  />
)

const SCRIPT_RENDERERS: Record<TThirdPartyAnalyticsProvider, TScriptRenderer> = {
  ga: renderGoogleAnalytics,
  gtm: renderGoogleTagManager,
  clarity: renderClarity,
  plausible: renderPlausible,
  fathom: renderFathom,
} as const

const ThirdPartyAnalyticsScripts = ({ configs = [] }: TProps) => {
  const renderableConfigs = getRenderableThirdPartyAnalyticsConfigs(configs ?? [])

  if (renderableConfigs.length === 0) return null

  // Script execution stays frontend-owned; the backend registry only describes
  // supported providers and fields, never executable script text.
  return (
    <>{renderableConfigs.map((config) => SCRIPT_RENDERERS[config.provider]?.(config) ?? null)}</>
  )
}

export default ThirdPartyAnalyticsScripts
