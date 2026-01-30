import { COLOR } from '~/const/colors'

export const STEP = {
  SELECT_TYPE: 'SELECT_TYPE',
  SETUP_DOMAIN: 'SETUP_DOMAIN',
  SETUP_INFO: 'SETUP_INFO',
  SETUP_EXTRA: 'SETUP_EXTRA',
  FINISHED: 'FINISHED',
} as const

export const COMMUNITY_TYPE = {
  PRODUCT: 'PRODUCT',
  GAMING: 'GAMING',
  TEACH: 'TEACH',
  GROUP: 'GROUP',
} as const

// TODO: remove later
export const COMMUNITY_CATS_COLOR = {
  [COMMUNITY_TYPE.PRODUCT]: COLOR.PURPLE,
  [COMMUNITY_TYPE.GAMING]: COLOR.BLUE,
  [COMMUNITY_TYPE.TEACH]: COLOR.GREEN,
  [COMMUNITY_TYPE.GROUP]: COLOR.ORANGE,
}

export const COMMUNITY_CATS = [
  {
    //
    type: COMMUNITY_TYPE.PRODUCT,
    title: '产品支持',
    color: COLOR.PURPLE,
  },
  {
    //
    type: COMMUNITY_TYPE.GAMING,
    title: '游戏开发',
    color: COLOR.ORANGE,
  },
  {
    //
    type: COMMUNITY_TYPE.TEACH,
    title: '课程 / 教学',
    color: COLOR.GREEN,
  },
  {
    //
    type: COMMUNITY_TYPE.GROUP,
    title: '圈子 / 团体',
    color: COLOR.BLUE,
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
