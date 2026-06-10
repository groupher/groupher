import { MockList } from '@graphql-tools/mock'

const nowISO = () => new Date().toISOString()
const todayISO = () => new Date().toISOString().slice(0, 10)

let __mockStrId = 0
const nextMockString = () => `mock_${++__mockStrId}`

const THEME_PRESET = {
  DEFAULT: 'DEFAULT',
}

const WALLPAPER_TYPE = {
  GRADIENT: 'gradient',
}

const GRADIENT_RENDERER = {
  LINEAR: 'linear',
}

const WALLPAPER_TEXTURE = {
  NOISE: 'noise',
}

const DEFAULT_THEME_TOKENS = {
  pageBg: '#fffcfc',
  pageBgDark: '#25161d',
  pageBgHue: 0,
  pageBgHueDark: 332,
  pageBgIntensity: 0,
  pageBgIntensityDark: 6,
  primaryColor: '#7d519e',
  primaryColorDark: '#9669b9',
  accentColor: '#5073c6',
  accentColorDark: '#3a7ec7',
  textTitle: '#243041',
  textTitleDark: '#f5f5f5',
  textDigest: '#6b7280',
  textDigestDark: '#949494',
  cardColor: '#ffffff',
  cardColorDark: '#252525',
  dividerColor: '#eae9e9',
  dividerColorDark: '#353535',
  gaussBlur: 100,
  gaussBlurDark: 100,
  glowType: '',
  glowTypeDark: '',
  glowFixed: true,
  glowOpacity: 100,
  glowOpacityDark: 100,
}

const makeThemeTokens = () => ({ ...DEFAULT_THEME_TOKENS })

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
      light: {
        type: WALLPAPER_TYPE.GRADIENT,
        source: 'pink',
        hasPattern: false,
        gradient: {
          version: 2,
          renderer: GRADIENT_RENDERER.LINEAR,
          preset: 'pink',
          colors: ['#FBEFDE', '#D8B9E3'],
          angle: 180,
          spread: 52,
        },
        patternId: '01',
        patternIntensity: 50,
        patternTone: 'dark',
        hasTexture: false,
        blurIntensity: 0,
        hasShadow: false,
        brightness: 100,
        saturation: 100,
        texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      },
      dark: {
        type: WALLPAPER_TYPE.GRADIENT,
        source: 'pink',
        hasPattern: false,
        gradient: {
          version: 2,
          renderer: GRADIENT_RENDERER.LINEAR,
          preset: 'pink',
          colors: ['#25161d', '#3a2945'],
          angle: 180,
          spread: 52,
        },
        patternId: '01',
        patternIntensity: 50,
        patternTone: 'dark',
        hasTexture: false,
        blurIntensity: 0,
        hasShadow: false,
        brightness: 100,
        saturation: 100,
        texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      },
    },
    layout: {
      themePreset: THEME_PRESET.DEFAULT,
      themeTokens: makeThemeTokens(),
      postLayout: 'QUORA',
      kanbanLayout: 'CLASSIC',
      kanbanCardLayout: 'SIMPLE',
      docCoverLayout: 'STACK_CARDS',
      docFaqLayout: 'COLLAPSE',
      tagLayout: 'HASH',
      inlineTagLayout: 'BORDER',
      avatarLayout: 'SQUARE',
      brandLayout: 'BOTH',
      communityLayout: 'CLASSIC',
      navActiveLayout: 'TEXT',
      topbarEnabled: false,
      topbarBg: 'BLACK',
      topbarBgCustomColor: '',
      broadcastLayout: 'DEFAULT',
      broadcastBg: 'CUSTOM',
      broadcastCustomBg: '',
      broadcastEnable: false,
      broadcastArticleLayout: 'DEFAULT',
      broadcastArticleBg: 'CUSTOM',
      broadcastArticleCustomBg: '',
      broadcastArticleEnable: false,
      changelogLayout: 'CLASSIC',
      footerLayout: 'GROUP',
      headerLayout: 'CENTER',
      overlayDark: false,
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
      rssFeedType: 'FULL',
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
    docFaq: {
      title: 'FAQ',
      desc: 'Common questions about docs',
      groupedView: true,
      groupItems: [
        {
          id: 'grp_basics',
          title: 'Basics',
          index: 0,
          items: [
            {
              id: 'faq_what_are_docs',
              title: 'What are docs for?',
              detail: 'Use docs to publish guides, references, and product help.',
              index: 0,
            },
          ],
        },
      ],
      flatItems: [
        {
          id: 'faq_get_started',
          title: 'How do I get started?',
          detail: 'Create your first guide, add a few common questions, then publish the docs.',
          index: 0,
        },
      ],
    },
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
