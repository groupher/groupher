import Script from 'next/script'

const UMAMI_BASE_URL = 'https://analysis.groupher.com'

const getWebAnalysisConfig = () => {
  const websiteId = process.env.WEB_ANALYSIS_WEBSITE_ID?.trim()

  if (!websiteId) return null

  return { websiteId }
}

export default function WebAnalysisScript() {
  const config = getWebAnalysisConfig()
  if (!config) return null

  return (
    <Script
      id='groupher-web-analysis'
      src={`${UMAMI_BASE_URL}/script.js`}
      data-website-id={config.websiteId}
      data-exclude-search='true'
      data-exclude-hash='true'
      strategy='afterInteractive'
    />
  )
}
