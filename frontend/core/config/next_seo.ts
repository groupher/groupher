import { SITE_NAME, SITE_SLOGAN, SITE_URL } from './values'

export default {
  title: SITE_NAME.toLowerCase(),
  description: SITE_SLOGAN,
  cannotical: SITE_URL,
  openGraph: {
    type: 'website',
    locale: 'zh_cn',
    url: SITE_URL,
    site_name: SITE_NAME.toLowerCase(),
    description: SITE_SLOGAN,
  },
  /*
     twitter: {
     handle: '@handle',
     site: '@site',
     cardType: 'summary_large_image',
     },
   */
}
