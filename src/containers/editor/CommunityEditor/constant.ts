import { COLOR_NAME } from '~/const/colors'

import type { TCommunityType, TStep } from './spec'

export const STEP = {
  SELECT_TYPE: 'SELECT_TYPE',
  SETUP_DOMAIN: 'SETUP_DOMAIN',
  SETUP_INFO: 'SETUP_INFO',
  SETUP_EXTRA: 'SETUP_EXTRA',
  FINISHED: 'FINISHED',
} as Record<Uppercase<TStep>, Uppercase<TStep>>

export const COMMUNITY_TYPE = {
  WEB: 'WEB',
  CLIENT: 'CLIENT',
  HARDWARE: 'HARDWARE',
  GAME: 'GAME',
} as Record<Uppercase<TCommunityType>, Uppercase<TCommunityType>>

export const COMMUNITY_CATS_COLOR = {
  [COMMUNITY_TYPE.WEB]: COLOR_NAME.PURPLE,
  [COMMUNITY_TYPE.CLIENT]: COLOR_NAME.BLUE,
  [COMMUNITY_TYPE.HARDWARE]: COLOR_NAME.GREEN,
  [COMMUNITY_TYPE.GAME]: COLOR_NAME.ORANGE,
}

export const COMMUNITY_CATS_TEXT_COLORS = {
  [COMMUNITY_TYPE.WEB]: ['#c479de', '#f8be6d'], // pink
  [COMMUNITY_TYPE.CLIENT]: ['#5c96f1', '#94d3e7'],
  [COMMUNITY_TYPE.HARDWARE]: ['#72B58C', '#C6D183'],
  [COMMUNITY_TYPE.GAME]: ['#ff862c', '#ffd599'],
}

export const COMMUNITY_CATS = [
  {
    //
    type: COMMUNITY_TYPE.WEB,
    title: '产品支持',
    color: COLOR_NAME.PURPLE,
    icon: 'Browser',
  },
  {
    //
    type: COMMUNITY_TYPE.GAME,
    title: '游戏开发',
    color: COLOR_NAME.ORANGE,
    icon: 'Game',
  },
  {
    //
    type: COMMUNITY_TYPE.HARDWARE,
    title: '课程 / 教学',
    color: COLOR_NAME.GREEN,
    icon: 'Robot',
  },
  {
    //
    type: COMMUNITY_TYPE.CLIENT,
    title: '圈子 / 团体',
    color: COLOR_NAME.BLUE,
    icon: 'Hammer',
  },
]

export const CITY_OPTIONS = [
  {
    label: '北京',
    value: 'beijing',
  },
  {
    label: '上海',
    value: 'shanghai',
  },
  {
    label: '杭州',
    value: 'hangzhou',
  },
  {
    label: '深圳',
    value: 'shenzheng',
  },
  {
    label: '广州',
    value: 'guangzhou',
  },
  {
    label: '苏州',
    value: 'suzhou',
  },
  {
    label: '成都',
    value: 'chengdu',
  },
  {
    label: '武汉',
    value: 'wuhan',
  },
  {
    label: '西安',
    value: 'xian',
  },
  {
    label: '海外',
    value: 'oversea',
  },
  {
    label: '其他',
    value: 'others',
  },
]

export const SOURCE_OPTIONS = [
  {
    label: '搜索引擎',
    value: 'seo',
  },
  {
    label: '微信群',
    value: 'wechat',
  },
  {
    label: 'Twitter',
    value: 'Twitter',
  },
  {
    label: '微博',
    value: 'weibo',
  },
  {
    label: '论坛',
    value: 'forum',
  },
  {
    label: '媒体报道',
    value: 'guangzhou',
  },
  {
    label: '小红书',
    value: 'xiaohongshu',
  },
  {
    label: '朋友/同事',
    value: 'otherdude',
  },
  {
    label: '其他',
    value: 'others',
  },
]
