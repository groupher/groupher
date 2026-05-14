import { SITE_URL } from './values'

const SITE_NAME = 'Groupher'
const SITE_SLOGAN =
  '让你的产品听见用户的声音。互动讨论、看板、更新日志、帮助文档多合一，收集整理用户用户反馈，助你打造更好的产品。'

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
