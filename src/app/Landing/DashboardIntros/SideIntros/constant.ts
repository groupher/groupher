import { COLOR_NAME } from '~/const/colors'
import { DASHBOARD_ROUTE } from '~/const/route'

import LayoutSVG from '~/icons/Layout'
import CMSSVG from '~/icons/CMS'
import SpiderSVG from '~/icons/Spider'
import HashTagBoldSVG from '~/icons/HashTagLight'
import AdminSVG from '~/icons/Admin'
import IntroHeaderFooterSVG from '~/icons/IntroHeaderFooter'
import IntroInoutSVG from '~/icons/IntroInout'

export default {
  [DASHBOARD_ROUTE.LAYOUT]: {
    title: '布局 & 样式',
    desc: '社区与内容展示的各种个性化设置',
    color: COLOR_NAME.PURPLE,
    icon: LayoutSVG,

    items: [
      '社区基本信息，主题色',
      '品牌展示样式',
      '社区整体布局',
      '讨论区布局',
      '看板布局，背景颜色',
      '更新日志布局',
      '壁纸，辉光，毛玻璃效果',
    ],
  },

  [DASHBOARD_ROUTE.POST]: {
    title: '内容管理',
    desc: '社区内容管理，文章状态设置',
    color: COLOR_NAME.BLUE,
    icon: CMSSVG,

    items: [
      '功能请求等类别设置',
      'GTD 状态转换',
      '标签设置',
      '置顶 / 合并 / 归档 / 删除',
      '自定义 slug, SEO 优化',
      '评论打开 / 关闭',
      '详细阅读统计',
    ],
  },

  [DASHBOARD_ROUTE.SEO]: {
    title: 'SEO / RSS',
    desc: '搜索引擎/社交媒体/RSS 优化及设置',
    color: COLOR_NAME.CYAN,
    icon: SpiderSVG,
    iconClass: 'size-8 opacity-40',

    items: [
      'OpenGraph 自定义设置',
      'Twitter Card 自定义设置',
      '自定义 RSS 输出',
      '自定义开启 / 关闭',
    ],
  },

  [DASHBOARD_ROUTE.TAGS]: {
    title: '标签设置',
    desc: '标签增改，样式等相关设置',
    color: COLOR_NAME.GREEN,
    icon: HashTagBoldSVG,

    items: [
      '社区基本信息，主题色',
      '品牌展示样式',
      '社区整体布局',
      '讨论区布局',
      '看板布局，背景颜色',
      '更新日志布局',
      '壁纸，辉光，毛玻璃效果',
    ],
  },

  [DASHBOARD_ROUTE.ADMINS]: {
    title: '管理员 & 权限管理',
    desc: '标签增改，样式等相关设置',
    color: COLOR_NAME.RED,
    icon: AdminSVG,

    items: [
      '社区基本信息，主题色',
      '品牌展示样式',
      '社区整体布局',
      '讨论区布局',
      '看板布局，背景颜色',
      '更新日志布局',
      '壁纸，辉光，毛玻璃效果',
    ],
  },

  [DASHBOARD_ROUTE.HEADER]: {
    title: '页头 & 页脚链接',
    desc: '链接及链接组管理',
    color: COLOR_NAME.BROWN,
    icon: IntroHeaderFooterSVG,

    items: [
      '社区基本信息，主题色',
      '品牌展示样式',
      '社区整体布局',
      '讨论区布局',
      '看板布局，背景颜色',
      '更新日志布局',
      '壁纸，辉光，毛玻璃效果',
    ],
  },

  [DASHBOARD_ROUTE.INOUT]: {
    title: '导入 & 通知',
    desc: '从其他服务商 / 平台导入内容',
    color: COLOR_NAME.YELLOW,
    icon: IntroInoutSVG,
    iconClass: 'size-8 opacity-80',

    items: [
      '社区基本信息，主题色',
      '品牌展示样式',
      '社区整体布局',
      '讨论区布局',
      '看板布局，背景颜色',
      '更新日志布局',
      '壁纸，辉光，毛玻璃效果',
    ],
  },
}
