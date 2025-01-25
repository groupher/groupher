import type { TUser, TTag, TCommunity } from '~/spec'
import { SITE_LOGO, ICON, ICON_BASE } from '~/config'
import { COLOR_NAME } from '~/const/colors'

import { getRandomInt } from './helper'

// https://playgroundai.com/search?q=Crunch+Pixar+avatar
const users = [
  {
    id: '1',
    avatar: '/avatars/2-purple.png',
    nickname: '橙猫猫',
    login: 'Sparkles',
    bio: 'the codex core teamf',
  },
  {
    id: '2',
    avatar: '/avatars/1-gray.png',
    nickname: '鱼摆摆',
    login: 'chatters',
    bio: 'Software Engineer specializing in Erlang/Elixir/Rust',
  },
  {
    id: '3',
    avatar: '/avatars/1.png',
    nickname: '圆滚滚',
    login: 'dimples',
    bio: 'Technical Director @nearform, TSC member',
  },
  {
    id: '4',
    avatar: '/avatars/2-gray.png',
    nickname: '鸡咯咯',
    login: 'lemonade',
    bio: 'Selenium Committer, Watir Core Team Developer',
  },
  {
    id: '5',
    avatar: '/avatars/5.png',
    nickname: '最爱电炒饭',
    login: 'susie',
    bio: 'Angel Investor, Serial Entrepreneur, Machine Learning PhD Student',
  },
  {
    id: '6',
    avatar: '/avatars/2-purple.png',
    nickname: '吕星星',
    login: 'muffin',
    bio: 'React Native Core team @ Facebook',
  },
  {
    id: '7',
    avatar: '/avatars/1-pink.png',
    nickname: '花生壳壳',
    login: 'daisy',
    bio: 'Software developer. Interested in Elixir and functional programming ',
  },
  {
    id: '8',
    avatar: '/avatars/1-orange.png',
    nickname: '橙喵喵',
    login: 'charlie',
    bio: 'the codex core teamf',
  },
  {
    id: '9',
    avatar: '/avatars/2-orange.png',
    nickname: 'Lulu',
    login: 'lulumi',
    bio: 'Software Engineer specializing in Erlang/Elixir/Rust',
  },
  {
    id: '10',
    avatar: '/avatars/3-pink.png',
    nickname: '吃莽莽',
    login: 'santhga',
    bio: 'Technical Director @nearform, TSC member',
  },
  {
    id: '11',
    avatar: '/avatars/1-green.png',
    nickname: '挖挖机',
    login: 'alex-wang',
    bio: 'Selenium Committer, Watir Core Team Developer',
  },
]

const tags = [
  {
    id: '104',
    slug: 'iOS',
    title: 'iOS',
    color: COLOR_NAME.RED,
    group: '平台',
  },
  {
    id: '103',
    slug: 'ad',
    title: '安卓',
    color: COLOR_NAME.RED,
    group: '平台',
  },
  {
    id: '10',
    slug: 'Web',
    title: '浏览器',
    color: COLOR_NAME.RED,
    group: '平台',
  },
  {
    id: '111',
    slug: 'q',
    title: '三方集成',
    color: COLOR_NAME.ORANGE,
    group: '产品',
  },
  {
    id: '11',
    slug: 'q',
    title: '权限',
    color: COLOR_NAME.GREEN,
    group: '产品',
  },
  {
    id: '12',
    slug: 'dp',
    title: '私有部署',
    color: COLOR_NAME.BROWN,
    group: '产品',
  },
  {
    id: '0',
    slug: 'admin',
    title: '后台管理',
    color: COLOR_NAME.RED,
    group: '产品',
  },
  {
    id: '1',
    slug: 'editor',
    title: '编辑器',
    color: COLOR_NAME.ORANGE,
    group: '产品',
  },
  {
    id: '2',
    slug: 'ui',
    title: 'UI/UX',
    color: COLOR_NAME.YELLOW,
    group: '产品',
  },
  {
    id: '4',
    slug: 'am',
    title: '官方通告',
    color: COLOR_NAME.CYAN,
    group: 'Welcome',
  },
  {
    id: '5',
    slug: 'showcase',
    title: 'Showcase',
    color: COLOR_NAME.CYAN_LIGHT,
    group: 'Welcome',
  },
  {
    id: '6',
    slug: 'start-here',
    title: '使用指南',
    color: COLOR_NAME.BLUE,
    group: 'Welcome',
  },
]

const communities = [
  {
    id: '0',
    title: 'Groupher',
    slug: 'home',
    desc: '可能是来为你心爱的产品建立一个反馈社区吧。',
    logo: SITE_LOGO,
  },
  {
    id: '1',
    title: '黑洞',
    slug: 'blackhole',
    desc: '吞噬一切不适合在本站出现的内容和账号',
    logo: `${ICON}/shape/blackhole.jpeg`,
  },
  {
    id: '2',
    title: 'React',
    slug: 'react',
    desc: '一个为数据提供渲染为HTML视图的开源JavaScript 库',
    logo: `${ICON_BASE}/framework/react.png`,
  },
  {
    id: '3',
    title: 'Elixir',
    slug: 'elixir',
    desc: 'Elixir 是一个基于 Erlang 虚拟机的函数式、面向并行的通用编程语言',
    logo: `${ICON_BASE}/pl/elixir.png`,
  },
  {
    id: '4',
    title: 'JavaScript',
    slug: 'javascript',
    desc: 'JavaScript is very cool',
    logo: `${ICON_BASE}/pl/javascript.png`,
  },
  {
    id: '5',
    title: 'Ruby',
    slug: 'ruby',
    desc: 'Ruby is very cool',
    logo: `${ICON_BASE}/pl/ruby.png`,
  },
  {
    id: '6',
    title: 'PHP',
    slug: 'php',
    desc: 'PHP is very cool',
    logo: `${ICON_BASE}/pl/php.png`,
  },
]

const images = [
  'https://rmt.dogedoge.com/fetch/~/source/unsplash/photo-1557555187-23d685287bc3?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&amp;ixlib=rb-1.2.1&amp;auto=format&amp;fit=crop&amp;w=1000&amp;q=80',
  'https://rmt.dogedoge.com/fetch/~/source/unsplash/photo-1484399172022-72a90b12e3c1?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&amp;ixlib=rb-1.2.1&amp;auto=format&amp;fit=crop&amp;w=1000&amp;q=80',
  'https://rmt.dogedoge.com/fetch/~/source/unsplash/photo-1617419086540-518c5b847b88?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=700&q=80',
  'https://rmt.dogedoge.com/fetch/~/source/unsplash/photo-1617365564200-c6b079284290?ixid=MXwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHwyNHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
  'https://rmt.dogedoge.com/fetch/~/source/unsplash/photo-1617391765934-f7ac7aa648bc?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=642&q=80',
  'https://rmt.dogedoge.com/fetch/~/source/unsplash/photo-1611095973362-88e8e2557e58?ixlib=rb-1.2.1&ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&auto=format&fit=crop&w=1050&q=80',
]

export const mockImage = (): string => {
  return images[getRandomInt(0, 4)]
}

export const mockImages = (num: number): string[] => {
  return images.slice(0, Math.min(num, images.length - 1))
}

export const mockUsers = (num: number): TUser[] => {
  return users.slice(0, Math.min(num, users.length - 1))
}

export const mockTags = (num: number): TTag[] => tags.slice(0, Math.min(num, tags.length))

const changelogTimeTags = [
  {
    id: '13',
    slug: '1',
    title: '1 月',
    group: '2022',
  },
  {
    id: '14',
    slug: '2',
    title: '2 月',
    group: '2022',
  },
  {
    id: '15',
    slug: '3',
    title: '3 月',
    group: '2022',
  },
  {
    id: '16',
    slug: '4',
    title: '4 月',
    group: '2022',
  },
  {
    id: '17',
    slug: '5',
    title: '5 月',
    group: '2022',
  },
  {
    id: '18',
    slug: '6',
    title: '6 月',
    group: '2022',
  },
  {
    id: '0',
    slug: '1',
    title: '1 月',
    group: '2021',
  },
  {
    id: '1',
    slug: '2',
    title: '2 月',
    group: '2021',
  },
  {
    id: '2',
    slug: '3',
    title: '3 月',
    group: '2021',
  },
]

export const mockChangelogTimeTags = (num = 10): TTag[] => {
  return changelogTimeTags.slice(0, Math.min(num, changelogTimeTags.length))
}

const changelogVersionTags = [
  {
    id: '13',
    slug: '1',
    title: 'v1.0.1',
    group: 'v1',
  },
  {
    id: '14',
    slug: '2',
    title: 'v1.0.2',
    group: 'v1',
  },
  {
    id: '15',
    slug: '3',
    title: 'v1.0.3',
    group: 'v1',
  },
  {
    id: '16',
    slug: '4',
    title: 'v1.0.4',
    group: 'v1',
  },
  {
    id: '17',
    slug: '5',
    title: 'v1.0.5',
    group: 'v1',
  },
  {
    id: '18',
    slug: '6',
    title: 'v1.0.6',
    group: 'v1',
  },
  {
    id: '0',
    slug: '1',
    title: 'v2.0.1',
    group: 'v2',
  },
  {
    id: '1',
    slug: '2',
    title: 'v2.0.2',
    group: 'v2',
  },
  {
    id: '2',
    slug: '3',
    title: 'v2.0.3',
    group: 'v2',
  },
]

export const mockChangelogVersionTags = (num = 10): TTag[] => {
  return changelogVersionTags.slice(0, Math.min(num, changelogVersionTags.length))
}

export const mockCommunities = (num: number): TCommunity[] =>
  communities.slice(0, Math.min(num, communities.length))

export const mockHelpCats = () => {
  return [
    {
      id: '0',
      title: 'Groupher 是什么?',
      desc: '可以。讨论区/看板/更新日志等等板块可以像使用积木一样按需使用，后台可一键开启。',
      color: COLOR_NAME.BLACK,
      articles: [
        {
          id: '0',
          title: '基本介绍',
        },
        {
          id: '1',
          title: '社区板块介绍',
        },
      ],
    },
    {
      id: '1',
      title: '个性化设置',
      desc: '可以。讨论区/看板/更新日志等等板块可以像使用积木一样按需使用，后台可一键开启。',
      color: COLOR_NAME.RED,
      articles: [
        {
          id: '0',
          title: '社区基本信息设置',
        },
        {
          id: '1',
          title: 'SEO 信息设置',
        },
        {
          id: '2',
          title: '社区板块',
        },
        {
          id: '3',
          title: '别名管理',
        },
        {
          id: '4',
          title: '自定义页头',
        },
        {
          id: '5',
          title: '自定义页脚',
        },
      ],
    },
    {
      id: '2',
      title: '社区内容管理',
      desc: '当然，Groupher 支持微信等国内主流社交软件的第三方登录。',
      color: COLOR_NAME.ORANGE,
      articles: [
        {
          id: '0',
          title: '讨论区帖子',
        },
        {
          id: '1',
          title: '看板墙',
        },
        {
          id: '2',
          title: '更新日志',
        },
        {
          id: '3',
          title: '帮助台内容',
        },
        {
          id: '4',
          title: '自定义页头',
        },
        {
          id: '5',
          title: '自定义页脚',
        },
      ],
    },
    {
      id: '3',
      title: '统计分析',
      desc: '当然，Groupher 提供 30 天免费试用，对开源项目可无任何限制的使用。',
      color: COLOR_NAME.BLUE,
      articles: [
        {
          id: '0',
          title: '社区基本信息设置',
        },
        {
          id: '1',
          title: 'SEO 信息设置',
        },
        {
          id: '2',
          title: '社区板块',
        },
        {
          id: '3',
          title: '别名管理',
        },
      ],
    },
    {
      id: '4',
      title: '联系我们',
      desc: '人手原因目前暂不支持独立部署，但未来会支持。独立部署版本不受任何限制。',
      color: COLOR_NAME.PURPLE,
      articles: [
        {
          id: '0',
          title: '社区基本信息设置',
        },
        {
          id: '1',
          title: 'SEO 信息设置',
        },
        {
          id: '2',
          title: '社区板块',
        },
        {
          id: '3',
          title: '别名管理',
        },
      ],
    },
    {
      id: '5',
      title: '隐私政策',
      desc: '支持，Groupher 支持高度自定义，从基础颜色到板块展现样式，各种细节均可自定义。',
      color: COLOR_NAME.GREEN,
      articles: [
        {
          id: '0',
          title: '社区基本信息设置',
        },
        {
          id: '1',
          title: 'SEO 信息设置',
        },
        {
          id: '2',
          title: '社区板块',
        },
        {
          id: '3',
          title: '别名管理',
        },
      ],
    },
    {
      id: '6',
      title: '绑定集成',
      desc: 'Groupher 完全开源在 Github 上，欢迎任何形式的参与。',
      color: COLOR_NAME.BLACK,
      articles: [
        {
          id: '0',
          title: '社区基本信息设置',
        },
        {
          id: '1',
          title: 'SEO 信息设置',
        },
        {
          id: '2',
          title: '社区板块',
        },
        {
          id: '3',
          title: '别名管理',
        },
      ],
    },
  ]
}
