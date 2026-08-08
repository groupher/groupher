import Script from 'next/script'

const UMAMI_BASE_URL = 'https://analysis.groupher.com'

type TProps = {
  websiteId?: string | null
}

export default function WebAnalysisScript({ websiteId }: TProps) {
  const id = websiteId?.trim()
  if (!id) return null

  return (
    <Script
      id='groupher-web-analysis'
      src={`${UMAMI_BASE_URL}/script.js`}
      data-website-id={id}
      data-exclude-search='true'
      data-exclude-hash='true'
      strategy='afterInteractive'
    />
  )
}
