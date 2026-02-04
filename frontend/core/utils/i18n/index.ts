// this is tmp, use react-i18n .. later

// import { useSearchParams } from 'next/navigation'

import { LOCALE } from '~/const/i18n'
import type { TLocale } from '~/spec'

/**
 * this query is used for GraphQL, which will be intercepted by frontend
 * in short: fake
 */
export const i18nQuery = `
  query($locale: String!) {
    clientI18n(locale: $locale) {
      locale
    }
  }
`

export const useParseLang = (): TLocale => {
  // const searchParams = useSearchParams()

  // return (searchParams.get('lang') || LOCALE.EN) as TLocale
  return LOCALE.EN
}

export const useParseLang2 = (searchParams: URLSearchParams): TLocale => {
  return (searchParams.get('lang') || LOCALE.EN) as TLocale
}

export const loadLocaleFile = (locale: TLocale = LOCALE.EN) => {
  return new Promise((resolve, reject) => {
    switch (locale) {
      case LOCALE.ZH:
        import('~/utils/i18n/zh')
          .then((module) => resolve(module.default))
          .catch((error) => reject(error))
        break
      case LOCALE.EN:
        import('~/utils/i18n/en')
          .then((module) => resolve(module.default))
          .catch((error) => reject(error))
        break
      default:
        reject(new Error(`Unsupported locale: ${locale}`))
    }
  })
}

const I18nDict = {
  community: '社区',
  posts: '帖子',
  kanban: '看板',
  changelog: '更新日志',
  doc: '文档',
  help: '文档',
  about: '关于',
  post: '帖子',
  share: '分享',
  users: '用户',
  blog: '博客',
  user: '用户',
  profile: '主页',
}

export const Trans = (key) => I18nDict[key] || key
