import { COLOR_NAME } from '~/const/colors'
import { DASHBOARD_ROUTE } from '~/const/route'

export const TABS_ITEMS = [
  {
    key: DASHBOARD_ROUTE.LAYOUT,
    title: '布局与样式',
    desc: '整体布局，主题色，壁纸，以及各板块内容展示样式等。',
    color: COLOR_NAME.PURPLE,
  },
  {
    key: DASHBOARD_ROUTE.POST,
    title: '社区内容管理',
    desc: '管理已发布内容，设置各种属性以及相关操作等。',
    color: COLOR_NAME.BLUE,
  },
  {
    key: DASHBOARD_ROUTE.SEO,
    title: 'SEO 优化',
    desc: '自定义主流搜索引擎以及 Twitter 断的关键字等.',
    color: COLOR_NAME.CYAN,
  },
  {
    key: DASHBOARD_ROUTE.TAGS,
    title: '标签设置与管理',
    desc: '各板块相关标签（组）的创建与属性变更。',
    color: COLOR_NAME.GREEN,
  },
  {
    key: DASHBOARD_ROUTE.ADMINS,
    title: '管理员 / 权限',
    desc: '指派社区管理员，设定相关人员权限。',
    color: COLOR_NAME.PINK,
  },
  {
    key: 'richeditor',
    title: '富文本编辑',
    desc: '社区主要统计指标，服务提供商等设定。',
    color: COLOR_NAME.RED,
  },
  {
    key: DASHBOARD_ROUTE.HEADER,
    title: '页头 / 页脚自定义',
    desc: '自定义社区页头以及页脚的自定链接（组）。',
    color: COLOR_NAME.ORANGE,
  },
  {
    key: DASHBOARD_ROUTE.INOUT,
    title: '数据导入 / 通知',
    desc: '支持外部主流 issue 管理工具导入内容，及通知主流 IM 工具。',
    color: COLOR_NAME.GREEN,
  },
  {
    key: DASHBOARD_ROUTE.WIDGETS,
    title: '绑定与集成',
    desc: '设置集成到目标网站的各种组件的相关属性。',
    color: COLOR_NAME.YELLOW,
  },
  {
    key: DASHBOARD_ROUTE.TREND,
    title: '统计分析',
    desc: '社区主要统计指标，服务提供商等设定。',
    color: COLOR_NAME.RED,
  },
]

export const holder = 1
