// this is tmp, use react-i18n .. later

import { useSearchParams } from 'next/navigation'

import type { TLocale } from '~/spec'
import { LOCALE } from '~/const/i18n'

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
  const searchParams = useSearchParams()

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
  doc: '帮助台',
  help: '帮助台',
  about: '关于',
  post: '帖子',
  share: '分享',
  users: '用户',
  blog: '博客',
  user: '用户',
  profile: '主页',

  // ArticleCat
  ALL: '全部',
  FEATURE: '请求功能',
  BUG: '问题上报',
  QUESTION: '求助/疑问',
  OTHER: '其他',
  // articleState;
  TODO: '待办项',
  WIP: '进行中',
  DONE: '已完成',
  SOLVED: '已解决',
  FIXED: '已修复',
  REJECT: '关闭',
  REJECT_DUP: '重复问题',
  REJECT_NO_PLAN: '无计划',
  REJECT_REPRO: '无法重现',
  REJECT_STALE: '过时',

  //
  PUBLISH: '发布时间',
  UPVOTE: '投票',
  UPVOTES: '投票数',
  COMMENT: '评论',
  COMMENTS: '评论数',
  VIEWS: '浏览量',

  // osocial
  EMAIL: '邮箱地址',
  HOMEPAGE: '官方主页',
  TIKTOK: '抖音',
  WECHAT: '微信',
  GITHUB: 'Github',
  TWITTER: '推特',
  ZHIHU: '知乎',
  BILIBILI: 'B站',
  WEIBO: '微博',
  BOSS: 'Boss 直聘',
  LAGOU: '拉钩',

  // city
  chengdu: '成都',
  wuhan: '武汉',
  beijing: '北京',
  shanghai: '上海',
  hangzhou: '杭州',
  shenzhen: '深圳',
  guangzhou: '广州',
  suzhou: '苏州',
  xian: '西安',
}

export const Trans = (key) => I18nDict[key] || key

export const holder = 1
