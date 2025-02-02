import { DASHBOARD_ALIAS_ROUTE } from './route'

export const HCN = 'home'

export const HOME_COMMUNITY = {
  home: 'groupher',
  slug: HCN,
  logo: '/groupher.png',
}

export const ALIAS_GROUP = {
  THREAD: DASHBOARD_ALIAS_ROUTE.THREAD,
  KANBAN: DASHBOARD_ALIAS_ROUTE.KANBAN,
  OTHERS: DASHBOARD_ALIAS_ROUTE.OTHERS,
}

export const BUILDIN_ALIAS = [
  {
    slug: 'post',
    name: '讨论',
    original: '讨论',
    group: ALIAS_GROUP.THREAD,
  },
  {
    slug: 'changelog',
    name: '更新日志',
    original: '更新日志',
    group: ALIAS_GROUP.THREAD,
  },
  {
    slug: 'kanban',
    name: '看板',
    original: '看板',
    group: ALIAS_GROUP.THREAD,
  },
  {
    slug: 'doc',
    name: '帮助台',
    original: '帮助台',
    group: ALIAS_GROUP.THREAD,
  },
  {
    slug: 'todo',
    name: '待办',
    original: '待办',
    group: ALIAS_GROUP.KANBAN,
  },
  {
    slug: 'wip',
    name: '进行中',
    original: '进行中',
    group: ALIAS_GROUP.KANBAN,
  },
  {
    slug: 'done',
    name: '已完成',
    original: '已完成',
    group: ALIAS_GROUP.KANBAN,
  },
  {
    slug: 'feature',
    name: '功能请求',
    original: '功能请求',
    group: ALIAS_GROUP.KANBAN,
  },
  {
    slug: 'bug',
    name: '问题上报',
    original: '问题上报',
    group: ALIAS_GROUP.KANBAN,
  },
  {
    slug: 'question',
    name: '求助 / 疑问',
    original: '求助 / 疑问',
    group: ALIAS_GROUP.KANBAN,
  },
  {
    slug: 'other',
    name: '其他讨论',
    original: '其他讨论',
    group: ALIAS_GROUP.KANBAN,
  },
  {
    slug: 'upvote',
    name: '投票',
    original: '投票',
    group: ALIAS_GROUP.OTHERS,
  },
  {
    slug: 'upvote_bug',
    name: '相同问题',
    original: '相同问题',
    group: ALIAS_GROUP.OTHERS,
  },
]
