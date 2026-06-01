import { COLOR } from '~/const/colors'

export enum STEP {
  SELECT_TYPE = 'SELECT_TYPE',
  SETUP_DOMAIN = 'SETUP_DOMAIN',
  SETUP_INFO = 'SETUP_INFO',
  SETUP_EXTRA = 'SETUP_EXTRA',
  FINISHED = 'FINISHED',
}

export enum COMMUNITY_TYPE {
  PRODUCT = 'PRODUCT',
  GAMING = 'GAMING',
  TEACH = 'TEACH',
  GROUP = 'GROUP',
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
