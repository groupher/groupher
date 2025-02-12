import { pluck } from 'ramda'

export const HOME_CITY_OPTIONS = [
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
]

export const OVERSEA_CITY_OPTIONS = [
  {
    label: '湾区',
    value: 'bay-area',
    flag: 'US',
  },
  {
    label: '纽约',
    value: 'new-york',
    flag: 'US',
  },
  {
    label: '西雅图',
    value: 'seattle',
    flag: 'US',
  },

  {
    label: '多伦多',
    value: 'toronto',
    flag: 'CA',
  },
  {
    label: '温哥华',
    value: 'vancouver',
    flag: 'CA',
  },
  {
    label: '墨尔本',
    value: 'melbourne',
    flag: 'AU',
  },
  {
    label: '伦敦',
    value: 'london',
    flag: 'EN',
  },
  {
    label: '东京',
    value: 'tokyo',
    flag: 'JP',
  },
  {
    label: '柏林',
    value: 'berlin',
    flag: 'DE',
  },
  {
    label: '新加坡',
    value: 'singapore',
    flag: 'SG',
  },
  {
    label: '曼谷',
    value: 'bangkok',
    flag: 'TH',
  },
]

export const CITY_OPTIONS = [...HOME_CITY_OPTIONS, ...OVERSEA_CITY_OPTIONS]

export const CITY_OPTION_VALUES = pluck('value', CITY_OPTIONS)
