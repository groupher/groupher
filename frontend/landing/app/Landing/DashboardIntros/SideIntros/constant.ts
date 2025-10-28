import { COLOR_NAME } from '~/const/colors'
import { DASHBOARD_ROUTE } from '~/const/route'
import AdminSVG from '~/icons/Admin'
import CMSSVG from '~/icons/CMS'
import HashTagBoldSVG from '~/icons/HashTagLight'
import IntroHeaderFooterSVG from '~/icons/IntroHeaderFooter'
import IntroInoutSVG from '~/icons/IntroInout'
import LayoutSVG from '~/icons/Layout'
import SpiderSVG from '~/icons/Spider'

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
      'OpenGraph 信息设置',
      'Twitter Card 自定义设置',
      'canonical 信息设置',
      '自定义 meta 信息',
      '开启 / 屏蔽爬虫',
      '自定义 RSS 输出',
    ],
  },

  [DASHBOARD_ROUTE.TAGS]: {
    title: '标签设置',
    desc: '标签增改，样式等相关设置',
    color: COLOR_NAME.GREEN,
    icon: HashTagBoldSVG,

    items: [
      '板块标签增删改',
      '标签颜色，样式，描述等',
      '标签内容展示模版',
      '自定义 URL slug',
      '支持私有 Tag, 仅内部可见',
      '关联内容统计',
    ],
  },

  [DASHBOARD_ROUTE.ADMINS]: {
    title: '管理员 & 权限',
    desc: '社区管理员设置，操作权限相关',
    color: COLOR_NAME.RED,
    icon: AdminSVG,

    items: [
      '原子级细化权限',
      '一键设置多种管理模式',
      '超级管理员转移',
      '重要操作日志记录',
      '管理员特殊标签',
      '社区相关页面公示',
      '活跃度统计',
    ],
  },

  [DASHBOARD_ROUTE.HEADER]: {
    title: '页头 & 页脚',
    desc: '链接及分组管理，展示模板设置',
    color: COLOR_NAME.BROWN,
    icon: IntroHeaderFooterSVG,

    items: [
      '社区基本信息',
      '页头/页脚链接，分组管理',
      '可视化排序调整',
      '个性化标签展示',
      '多种展示模板',
      '响应式设计',
    ],
  },

  [DASHBOARD_ROUTE.INOUT]: {
    title: '导入 & 通知',
    desc: '三方平台导入内容 / 信息通知',
    color: COLOR_NAME.YELLOW,
    icon: IntroInoutSVG,
    iconClass: 'size-8 opacity-80',

    items: [
      '主流平台内容一键导入',
      'Markdown / CSV 等手动导入',
      '主流 IM 平台通知机器人',
      'webhook 通知机制',
      'RSS 内容输出',
      '邮件精准通知',
      '多种高模板自定义',
    ],
  },
}
