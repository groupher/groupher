import { MockList } from '@graphql-tools/mock'

const nowISO = () => new Date().toISOString()
const todayISO = () => new Date().toISOString().slice(0, 10)

let __mockStrId = 0
const nextMockString = () => `mock_${++__mockStrId}`

const DEFAULT_THEME_TOKENS = {
  pageBg: 'CUSTOM',
  pageBgDark: 'CUSTOM',
  pageCustomBg: 0,
  pageCustomBgDark: 0,
  pageCustomIntensity: 0,
  pageCustomIntensityDark: 15,
  primaryColor: 'PURPLE',
  primaryCustomColor: '',
  primaryCustomColorDark: '',
  accentColor: 'BLUE',
  accentCustomColor: '',
  accentCustomColorDark: '',
  textTitle: '#243041',
  textDigest: '#6b7280',
  gaussBlur: 100,
  gaussBlurDark: 100,
}

const makeUser = (overrides = {}) => {
  return {
    id: overrides.id ?? 'u_e2e',
    login: overrides.login ?? 'e2e',
    nickname: overrides.nickname ?? 'E2E User',
    avatar: overrides.avatar ?? 'https://static.groupher.com/icons/cmd/alien_user3.svg',
    ...overrides,
  }
}

const makeDashboard = (slug = 'home') => {
  return {
    seo: {
      seoEnable: true,
      ogSiteName: 'Groupher (Mock)',
      ogTitle: 'Groupher (Mock)',
      ogDescription: 'Mocked GraphQL server for e2e',
      ogUrl: 'http://localhost:3000',
      ogImage: 'https://assets.groupher.com/icons/static/new-logo.jpg',
      ogLocale: 'en',
      ogPublisher: 'Groupher',
      twTitle: 'Groupher (Mock)',
      twDescription: 'Mocked GraphQL server for e2e',
      twUrl: 'http://localhost:3000',
      twCard: 'summary_large_image',
      twSite: '@groupher',
      twImage: 'https://assets.groupher.com/icons/static/new-logo.jpg',
      twImageWidth: '1200',
      twImageHeight: '630',
    },
    wallpaper: {
      wallpaperType: 'color',
      wallpaper: '#f7f6f3',
      hasPattern: false,
      direction: 'to bottom',
      customColorValue: '#f7f6f3',
      bgSize: 'cover',
      uploadBgImage: '',
      hasBlur: false,
      hasShadow: false,
    },
    layout: {
      themePreset: 'DEFAULT',
      themeTokens: DEFAULT_THEME_TOKENS,
      pageBg: 'CUSTOM',
      pageBgDark: 'CUSTOM',
      pageCustomBg: 0,
      pageCustomBgDark: 0,
      pageCustomIntensity: 0,
      pageCustomIntensityDark: 15,
      textTitle: '#243041',
      textDigest: '#6b7280',
      postLayout: 'quora',
      kanbanLayout: 'classic',
      kanbanCardLayout: 'simple',
      docCoverLayout: 'stack_cards',
      docFaqLayout: 'collapse',
      tagLayout: 'hash',
      inlineTagLayout: 'border',
      avatarLayout: 'circle',
      brandLayout: 'logo',
      communityLayout: 'classic',
      navActiveLayout: 'menu',
      topbarEnabled: false,
      topbarBg: 'BLACK',
      topbarBgCustomColor: '',
      broadcastLayout: 'default',
      broadcastBg: 'CUSTOM',
      broadcastCustomBg: '',
      broadcastEnable: false,
      broadcastArticleLayout: 'default',
      broadcastArticleBg: 'CUSTOM',
      broadcastArticleCustomBg: '',
      broadcastArticleEnable: false,
      changelogLayout: 'classic',
      footerLayout: 'simple',
      headerLayout: 'center',
      glowType: '',
      glowFixed: false,
      glowOpacity: '0',
      overlayDark: false,
      gaussBlur: DEFAULT_THEME_TOKENS.gaussBlur,
      gaussBlurDark: DEFAULT_THEME_TOKENS.gaussBlurDark,
      kanbanBgColors: ['BLUE', 'PURPLE'],
    },
    enable: {
      post: true,
      kanban: true,
      changelog: true,
      doc: true,
      docLastUpdate: true,
      docReaction: true,
      about: true,
      aboutTechstack: true,
      aboutLocation: true,
      aboutLinks: true,
      aboutMediaReport: true,
    },
    baseInfo: {
      favicon: 'https://assets.groupher.com/icons/static/new-logo.jpg',
      title: `Mock Community (${slug})`,
      locale: 'en',
      logo: 'https://assets.groupher.com/icons/static/new-logo.jpg',
      slug,
      desc: 'Mocked community for e2e',
      introduction: 'Mocked community for e2e',
      homepage: 'http://localhost:3000',
      city: 'Shanghai',
      techstack: 'GraphQL / Next.js',
    },
    rss: {
      rssFeedType: 'full',
      rssFeedCount: 20,
    },
    nameAlias: [],
    headerLinks: [
      {
        id: 'header-link-home',
        type: 'LINK',
        title: 'Home',
        url: `/${slug}/post`,
      },
    ],
    footerLinks: [
      {
        id: 'footer-group-main',
        type: 'GROUP',
        title: 'main',
        links: [
          {
            id: 'footer-link-about',
            title: 'About',
            url: `/${slug}/about`,
          },
        ],
      },
    ],
    socialLinks: [],
    mediaReports: [],
    faqs: [],
  }
}

const makeCommunity = (slug = 'home') => {
  return {
    id: `c_${slug}`,
    slug,
    title: `Mock Community (${slug})`,
    desc: 'Mocked community for e2e',
    dashboard: makeDashboard(slug),
    moderators: [],
    viewerHasSubscribed: false,
    viewerIsModerator: true,
  }
}

const HOME_COMMUNITY = makeCommunity('home')

const makePost = (idx, communitySlug = 'home') => {
  return {
    innerId: `p_${idx}`,
    title: `Mock Post #${idx}`,
    digest: 'This is mocked post digest.',
    views: 123,
    upvotesCount: 4,
    commentsCount: 1,
    communitySlug,
    community: makeCommunity(communitySlug),
    author: makeUser({ id: `u_${idx}`, login: `user_${idx}`, nickname: `User ${idx}` }),
    insertedAt: nowISO(),
    updatedAt: nowISO(),
    activeAt: nowISO(),
  }
}

const HOME_PAGED_POSTS = {
  entries: [makePost(1, 'home'), makePost(2, 'home'), makePost(3, 'home')],
  totalCount: 3,
  pageSize: 20,
  totalPages: 1,
  pageNumber: 1,
}

export const mocks = {
  // Avoid @graphql-tools/mock default "Hello World" everywhere.
  // Also reduces duplicate React keys when some list uses string fields as keys.
  String: () => nextMockString(),
  DateTime: () => nowISO(),
  Date: () => todayISO(),
  Json: () => ({}),

  RootQueryType: () => ({
    me: () => makeUser(),
    sessionState: () => ({ isValid: true, user: makeUser() }),

    community: (_parent, args) => {
      const slug = args?.slug ?? 'home'
      if (slug === 'home') return HOME_COMMUNITY
      return makeCommunity(slug)
    },
    pagedPosts: (_parent, args) => {
      const community = args?.filter?.community ?? 'home'
      if (community === 'home') {
        return {
          ...HOME_PAGED_POSTS,
          pageNumber: args?.filter?.page ?? 1,
        }
      }

      return {
        entries: [makePost(1, community), makePost(2, community)],
        totalCount: 2,
        pageSize: 20,
        totalPages: 1,
        pageNumber: args?.filter?.page ?? 1,
      }
    },

    // keep other queries usable without explicit mocks
    pagedComments: () => ({
      entries: new MockList([0, 3]),
      totalCount: 0,
      pageSize: 20,
      totalPages: 0,
      pageNumber: 1,
    }),
  }),
}
