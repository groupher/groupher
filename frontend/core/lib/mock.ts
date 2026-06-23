import { COLOR } from '~/const/colors'
import type { TTag, TUser } from '~/spec'

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
    color: COLOR.RED,
    group: '平台',
  },
  {
    id: '103',
    slug: 'ad',
    title: '安卓',
    color: COLOR.RED,
    group: '平台',
  },
  {
    id: '10',
    slug: 'Web',
    title: '浏览器',
    color: COLOR.RED,
    group: '平台',
  },
  {
    id: '111',
    slug: 'q',
    title: '三方集成',
    color: COLOR.ORANGE,
    group: '产品',
  },
  {
    id: '11',
    slug: 'q',
    title: '权限',
    color: COLOR.GREEN,
    group: '产品',
  },
  {
    id: '12',
    slug: 'dp',
    title: '私有部署',
    color: COLOR.BROWN,
    group: '产品',
  },
  {
    id: '0',
    slug: 'admin',
    title: '后台管理',
    color: COLOR.RED,
    group: '产品',
  },
  {
    id: '1',
    slug: 'editor',
    title: '编辑器',
    color: COLOR.ORANGE,
    group: '产品',
  },
  {
    id: '2',
    slug: 'ui',
    title: 'UI/UX',
    color: COLOR.YELLOW,
    group: '产品',
  },
  {
    id: '4',
    slug: 'am',
    title: '官方通告',
    color: COLOR.CYAN,
    group: 'Welcome',
  },
  {
    id: '5',
    slug: 'showcase',
    title: 'Showcase',
    color: COLOR.CYAN_LIGHT,
    group: 'Welcome',
  },
  {
    id: '6',
    slug: 'start-here',
    title: '使用指南',
    color: COLOR.BLUE,
    group: 'Welcome',
  },
]

const images = [
  'https://feed.muzli.cloud/muzli_feed/wp-content/uploads/2026/04/17235039/claude_design-1-1.png',
  'https://ph-files.imgix.net/e8fedd1e-2775-4868-8769-9c74be268563.png?auto=format',
  'https://files.muzli.cloud/9d1f045a5091ac03719db58d9022466d.jpeg',
  'https://files.muzli.cloud/3906721ed134fc1e90621ca9de80b10e.jpeg',
  'https://files.muzli.cloud/8699406f17b698906c95aa6a28052a89.jpeg',
  'https://uploads.sitepoint.com/wp-content/uploads/medium_Why_Is_Email_Deliverability_Important_fd4d27f1c3.png',
  'https://files.muzli.cloud/d591b0c7613aa00330e7becf594abccf.jpeg',
  'https://files.muzli.cloud/5b0e2e6b3b586a4f1d430c12c5ba374e.jpg',
]

const getStableImageIndex = (seed: string | number): number => {
  return (
    String(seed)
      .split('')
      .reduce((sum, char) => sum + char.charCodeAt(0), 0) % images.length
  )
}

export const mockImage = (seed?: string | number): string => {
  if (seed !== undefined) return images[getStableImageIndex(seed)]

  return images[getRandomInt(0, 4)]
}

export const mockUsers = (num: number): TUser[] => {
  return users.slice(0, Math.min(num, users.length - 1))
}

export const mockTags = (num: number): TTag[] => tags.slice(0, Math.min(num, tags.length))

export const mockHelpCats = () => {
  return [
    {
      id: '0',
      title: 'Groupher 是什么?',
      desc: '可以。讨论区/看板/更新日志等等板块可以像使用积木一样按需使用，后台可一键开启。',
      color: COLOR.BLACK,
      articles: [
        {
          id: '0',
          title: '基本介绍',
          desc: '了解 Groupher 的定位与核心能力。',
        },
        {
          id: '1',
          title: '社区板块介绍',
          desc: '快速浏览讨论区、看板与文档的组织方式。',
        },
      ],
    },
    {
      id: '1',
      title: '个性化设置',
      desc: '可以。讨论区/看板/更新日志等等板块可以像使用积木一样按需使用，后台可一键开启。',
      color: COLOR.RED,
      articles: [
        {
          id: '0',
          title: '社区基本信息设置',
          desc: '设置标题、域名、Logo 与社区基础资料。',
        },
        {
          id: '1',
          title: 'SEO 信息设置',
          desc: '配置搜索引擎摘要与社交分享信息。',
        },
        {
          id: '2',
          title: '社区板块',
          desc: '按需开启或关闭公开板块。',
        },
        {
          id: '3',
          title: '别名管理',
          desc: '自定义频道与导航文案。',
        },
        {
          id: '4',
          title: '自定义页头',
          desc: '调整顶部品牌区与导航展现。',
        },
        {
          id: '5',
          title: '自定义页脚',
          desc: '配置页脚链接与补充信息。',
        },
      ],
    },
    {
      id: '2',
      title: '社区内容管理',
      desc: '当然，Groupher 支持微信等国内主流社交软件的第三方登录。',
      color: COLOR.ORANGE,
      articles: [
        {
          id: '0',
          title: '讨论区帖子',
          desc: '管理文章、分类与置顶内容。',
        },
        {
          id: '1',
          title: '看板墙',
          desc: '用状态列梳理反馈与路线图。',
        },
        {
          id: '2',
          title: '更新日志',
          desc: '统一维护版本发布与变更记录。',
        },
        {
          id: '3',
          title: '文档内容',
          desc: '维护帮助中心与产品文档。',
        },
        {
          id: '4',
          title: '自定义页头',
          desc: '为内容区提供更清晰的入口。',
        },
        {
          id: '5',
          title: '自定义页脚',
          desc: '补充说明、链接与版权信息。',
        },
      ],
    },
    {
      id: '3',
      title: '统计分析',
      desc: '当然，Groupher 提供 30 天免费试用，对开源项目可无任何限制的使用。',
      color: COLOR.BLUE,
      articles: [
        {
          id: '0',
          title: '社区基本信息设置',
          desc: '查看基础信息与默认展示设置。',
        },
        {
          id: '1',
          title: 'SEO 信息设置',
          desc: '追踪搜索流量与收录表现。',
        },
        {
          id: '2',
          title: '社区板块',
          desc: '分析不同板块的访问情况。',
        },
        {
          id: '3',
          title: '别名管理',
          desc: '比对不同入口文案的效果。',
        },
      ],
    },
    {
      id: '4',
      title: '联系我们',
      desc: '人手原因目前暂不支持独立部署，但未来会支持。独立部署版本不受任何限制。',
      color: COLOR.PURPLE,
      articles: [
        {
          id: '0',
          title: '社区基本信息设置',
          desc: '查看联系渠道与服务说明。',
        },
        {
          id: '1',
          title: 'SEO 信息设置',
          desc: '了解工单与反馈的提交方式。',
        },
        {
          id: '2',
          title: '社区板块',
          desc: '找到适合的问题分类入口。',
        },
        {
          id: '3',
          title: '别名管理',
          desc: '快速联系社区维护者。',
        },
      ],
    },
    {
      id: '5',
      title: '隐私政策',
      desc: '支持，Groupher 支持高度自定义，从基础颜色到板块展现样式，各种细节均可自定义。',
      color: COLOR.GREEN,
      articles: [
        {
          id: '0',
          title: '社区基本信息设置',
          desc: '掌握数据采集与使用方式。',
        },
        {
          id: '1',
          title: 'SEO 信息设置',
          desc: '阅读账户与权限相关条款。',
        },
        {
          id: '2',
          title: '社区板块',
          desc: '查看内容可见性与访问限制。',
        },
        {
          id: '3',
          title: '别名管理',
          desc: '了解隐私设置与合规说明。',
        },
      ],
    },
    {
      id: '6',
      title: '绑定集成',
      desc: 'Groupher 完全开源在 Github 上，欢迎任何形式的参与。',
      color: COLOR.BLACK,
      articles: [
        {
          id: '0',
          title: '社区基本信息设置',
          desc: '连接常用开发与协作平台。',
        },
        {
          id: '1',
          title: 'SEO 信息设置',
          desc: '配置同步、通知与 webhook。',
        },
        {
          id: '2',
          title: '社区板块',
          desc: '管理第三方接入的权限范围。',
        },
        {
          id: '3',
          title: '别名管理',
          desc: '组合你的自动化工作流。',
        },
      ],
    },
  ]
}
