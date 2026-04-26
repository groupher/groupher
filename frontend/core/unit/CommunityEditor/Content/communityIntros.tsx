import { ICON_BASE } from '~/config'
import { HOME_COMMUNITY } from '~/const/name'
import { ROUTE } from '~/const/route'

const COMMUNITY_INTRO = {
  PRODUCT: {
    title: '什么是 Web 应用?',
    desc: '你的产品主要通过浏览器 web 端为用户提供服务，如网站，H5 页面等。',
    threads: [ROUTE.POST, ROUTE.KANBAN, ROUTE.CHANGELOG, ROUTE.HELP, ROUTE.ABOUT],
    demos: [
      {
        title: 'javascript',
        slug: 'JavaScript',
        logo: `${ICON_BASE}/pl/javascript.png`,
      },
      {
        title: 'React',
        slug: 'react',
        logo: `${ICON_BASE}/framework/react.png`,
      },
      {
        title: 'Phoenix',
        slug: 'phoneix',
        logo: `${ICON_BASE}/framework/phoenix.png`,
      },
      {
        title: 'Elixir',
        slug: 'elixir',
        logo: `${ICON_BASE}/pl/elixir.png`,
      },
      {
        title: 'Nim',
        slug: 'Nim',
        logo: `${ICON_BASE}/pl/nim.png`,
      },
    ],
  },

  TEACH: {
    title: '什么是硬件产品',
    desc: '各类机器人，无人机及其类似可玩性较强的硬件类及工业类产品。',
    threads: [ROUTE.POST, ROUTE.KANBAN, ROUTE.CHANGELOG, ROUTE.HELP, ROUTE.ABOUT],
    demos: [
      {
        title: 'CP-feedback',
        slug: HOME_COMMUNITY.slug,
      },
    ],
  },
  GAMING: {
    title: '什么是独立游戏',
    desc: '个人或小团队开发的平台或手机游戏，Indie Game Rocks!',
    threads: [ROUTE.POST, ROUTE.KANBAN, ROUTE.CHANGELOG, ROUTE.HELP, ROUTE.ABOUT],
    demos: [
      {
        title: '北京',
        slug: 'beijing',
        logo: `${ICON_BASE}/city/beijing.svg`,
      },
      {
        title: '上海',
        slug: 'shanghai',
        logo: `${ICON_BASE}/city/shanghai.svg`,
      },
      {
        title: '杭州',
        slug: 'hangzhou',
        logo: `${ICON_BASE}/city/hangzhou.svg`,
      },
      {
        title: '深圳',
        slug: 'shenzhen',
        logo: `${ICON_BASE}/city/shenzhen.svg`,
      },

      {
        title: '成都',
        slug: 'chengdu',
        logo: `${ICON_BASE}/city/chengdu.svg`,
      },
    ],
  },
  GROUP: {
    title: '什么是客户端软件?',
    desc: '包括但不限于各行业 PC / Mac 端生产力工具，手机 APP 等。',
    threads: [ROUTE.POST, ROUTE.KANBAN, ROUTE.CHANGELOG, ROUTE.HELP, ROUTE.ABOUT],
    demos: [
      {
        title: 'Groupher',
        slug: HOME_COMMUNITY.slug,
        logo: '',
      },
    ],
  },
}

export default COMMUNITY_INTRO
