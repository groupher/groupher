import { GraphQLError } from 'graphql'

import {
  createAuthSession,
  listAuthSessions,
  refreshAuthSession,
  revokeAuthSession,
  revokeAuthSessionPublic,
  revokeOtherAuthSessions,
} from './auth-state.js'
import { mockPage } from './pagination.js'
import { ticketQueries, ticketMutations } from './tickets.js'

const nowISO = () => new Date().toISOString()
const todayISO = () => new Date().toISOString().slice(0, 10)

let __mockStrId = 0
const nextMockString = () => `mock_${++__mockStrId}`

const initialDocDraftState = () => ({
  scenario: 'conflict',
  calls: 0,
  receipts: new Map(),
  draft: {
    id: 'e2e-draft',
    docId: 'e2e-doc',
    branchId: '1',
    version: 4,
    contentHash: 'e2e-content-hash',
    title: 'Canonical title',
    subtitle: 'Canonical subtitle',
    slug: 'canonical-title',
    stage: 'DRAFT',
    digest: 'Canonical subtitle',
    insertedAt: nowISO(),
    updatedAt: nowISO(),
    author: makeUser(),
    body: {
      json: JSON.stringify([{ type: 'p', children: [{ text: 'Canonical body' }] }]),
      markdown: 'Canonical body',
      toc: [],
      html: '<p>Canonical body</p>',
    },
    assetRefs: [],
  },
})

let docDraftState

/** Resets the Docs autosave mock to one isolated scenario and canonical draft. */
export const resetDocDraftState = (scenario = 'conflict') => {
  docDraftState = initialDocDraftState()
  docDraftState.scenario = scenario
}

/** Selects and resets the deterministic Docs autosave scenario used by browser tests. */
export const setDocDraftScenario = (scenario) => {
  if (!['success', 'conflict', 'rate_limit_then_success'].includes(scenario))
    throw new Error(`Unknown Doc Draft scenario: ${scenario}`)
  resetDocDraftState(scenario)
}

/** Returns observable Docs autosave calls, receipts, and persisted draft state for assertions. */
export const getDocDraftState = () => ({
  calls: docDraftState.calls,
  draft: docDraftState.draft,
  receiptCount: docDraftState.receipts.size,
  scenario: docDraftState.scenario,
})

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

const WALLPAPER_PATTERN_TONE = {
  DARK: 'dark',
}

const DEFAULT_WALLPAPER_SOURCE = 'amber_mauve'
const DEFAULT_WALLPAPER_PATTERN_ID = '01'
const WALLPAPER_PROFILES = {
  wide: { width: 1920, height: 1080 },
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 1366 },
  phone: { width: 390, height: 844 },
}

const DEFAULT_THEME_TOKENS = {
  shared: {
    glowFixed: true,
  },
  light: {
    pageBg: '#fffcfc',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#7d519e',
    accentColor: '#5073c6',
    textTitle: '#243041',
    textDigest: '#6b7280',
    cardColor: '#ffffff',
    dividerColor: '#eae9e9',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 100,
  },
  dark: {
    pageBg: '#25161d',
    pageBgHue: 332,
    pageBgIntensity: 6,
    primaryColor: '#9669b9',
    accentColor: '#3a7ec7',
    textTitle: '#f5f5f5',
    textDigest: '#949494',
    cardColor: '#252525',
    dividerColor: '#353535',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 100,
  },
}

const makeThemeTokens = () => JSON.parse(JSON.stringify(DEFAULT_THEME_TOKENS))

const THIRD_PARTY_ANALYTICS_SCENARIOS = {
  none: {
    persisted: [],
    enabled: [],
  },
  disabled: {
    persisted: [{ provider: 'ga', enabled: false, measurementId: 'G-E2E1234' }],
    enabled: [],
  },
  invalid: {
    persisted: [{ provider: 'ga', enabled: true, measurementId: 'not-a-ga-id' }],
    enabled: [],
  },
  ga: {
    persisted: [{ provider: 'ga', enabled: true, measurementId: 'G-E2E1234' }],
    enabled: [{ provider: 'ga', enabled: true, measurementId: 'G-E2E1234' }],
  },
  multiple: {
    persisted: [
      { provider: 'ga', enabled: true, measurementId: 'G-E2E1234' },
      { provider: 'fathom', enabled: true, siteId: 'FATHOME2E' },
    ],
    enabled: [
      { provider: 'ga', enabled: true, measurementId: 'G-E2E1234' },
      { provider: 'fathom', enabled: true, siteId: 'FATHOME2E' },
    ],
  },
}

let thirdPartyAnalyticsScenario = 'none'

const scenarioFromSlug = (slug) => {
  if (slug.endsWith('-analytics-none')) return 'none'
  if (slug.endsWith('-analytics-disabled')) return 'disabled'
  if (slug.endsWith('-analytics-invalid')) return 'invalid'
  if (slug.endsWith('-analytics-ga')) return 'ga'
  if (slug.endsWith('-analytics-multiple')) return 'multiple'
  return thirdPartyAnalyticsScenario
}

/** Runs the set third party analytics scenario operation at the frontend shared boundary. */
export const setThirdPartyAnalyticsScenario = (scenario) => {
  if (!Object.hasOwn(THIRD_PARTY_ANALYTICS_SCENARIOS, scenario)) {
    throw new Error(`Unknown third-party analytics scenario: ${scenario}`)
  }

  thirdPartyAnalyticsScenario = scenario
}

const getThirdPartyAnalyticsScenario = (slug) =>
  THIRD_PARTY_ANALYTICS_SCENARIOS[scenarioFromSlug(slug)]

const copyAnalyticsConfigs = (configs) => configs.map((config) => ({ ...config }))

const makeWallpaperTheme = (overrides = {}) => ({
  type: WALLPAPER_TYPE.GRADIENT,
  source: DEFAULT_WALLPAPER_SOURCE,
  pattern: {
    enabled: true,
    id: DEFAULT_WALLPAPER_PATTERN_ID,
    intensity: 50,
    tone: WALLPAPER_PATTERN_TONE.DARK,
  },
  gradient: {
    version: 2,
    renderer: GRADIENT_RENDERER.LINEAR,
    preset: DEFAULT_WALLPAPER_SOURCE,
    colors: ['#FBEFDE', '#D8B9E3'],
    angle: 180,
    spread: 58,
  },
  effect: {
    blurIntensity: 0,
    brightness: 100,
    saturation: 100,
  },
  texture: { enabled: false, type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
  ...overrides,
})

const makeWallpaperSettings = (theme) => ({
  settingsSchemaVersion: 1,
  type: theme.type.toUpperCase(),
  source: theme.source,
  customWallpaper: null,
  renderConfig: {
    pattern: theme.pattern,
    gradient: theme.gradient,
    texture: theme.texture,
    effect: theme.effect,
  },
})

const makeWallpaperImage = (slug, theme, profile) => {
  const { width, height } = WALLPAPER_PROFILES[profile]

  return {
    height,
    url: `https://assets.groupher.com/mock/wallpaper/${slug}-${theme}-${profile}.webp`,
    width,
  }
}

const makePublishedWallpaperTheme = (slug, theme) =>
  Object.fromEntries(
    Object.keys(WALLPAPER_PROFILES).map((profile) => [
      profile,
      makeWallpaperImage(slug, theme, profile),
    ]),
  )

const makePublishedWallpaper = (slug) => ({
  version: 1,
  light: makePublishedWallpaperTheme(slug, 'light'),
  dark: makePublishedWallpaperTheme(slug, 'dark'),
  lightSource: DEFAULT_WALLPAPER_SOURCE,
  darkSource: DEFAULT_WALLPAPER_SOURCE,
})

const makeUser = (overrides = {}) => {
  const safeOverrides = { ...overrides }
  delete safeOverrides.id

  return {
    login: overrides.login ?? 'e2e',
    nickname: overrides.nickname ?? 'E2E User',
    avatar: overrides.avatar ?? 'https://static.groupher.com/icons/cmd/alien_user3.svg',
    ...safeOverrides,
  }
}

resetDocDraftState()

const makeDashboard = (slug = 'home') => {
  const lightWallpaper = makeWallpaperTheme()
  const darkWallpaper = makeWallpaperTheme({
    gradient: {
      version: 2,
      renderer: GRADIENT_RENDERER.LINEAR,
      preset: DEFAULT_WALLPAPER_SOURCE,
      colors: ['#25161d', '#3a2945'],
      angle: 180,
      spread: 58,
    },
  })

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
      ...makePublishedWallpaper(slug),
    },
    wallpaperSettings: {
      light: makeWallpaperSettings(lightWallpaper),
      dark: makeWallpaperSettings(darkWallpaper),
    },
    contentShadow: false,
    pagiMode: 'PAGE',
    pagiMobileMode: 'INFINITE_SCROLL',
    pagiRevision: 0,
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
    thirdPartyAnalytics: copyAnalyticsConfigs(getThirdPartyAnalyticsScenario(slug).persisted),
    enabledThirdPartyAnalytics: copyAnalyticsConfigs(getThirdPartyAnalyticsScenario(slug).enabled),
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
    slug,
    title: `Mock Community (${slug})`,
    desc: 'Mocked community for e2e',
    dashboard: makeDashboard(slug),
    viewerHasSubscribed: false,
    viewerIsModerator: true,
  }
}

const HOME_COMMUNITY = makeCommunity('home')

const makePost = (idx, community = 'home') => {
  return {
    id: `post_${community}_${idx}`,
    thread: 'POST',
    innerId: `p_${idx}`,
    communityTags: [],
    isPinned: false,
    title: `Mock Post #${idx}`,
    digest: 'This is mocked post digest.',
    views: 123,
    upvotesCount: 4,
    commentsCount: 1,
    community: makeCommunity(community),
    author: makeUser({ login: `user_${idx}`, nickname: `User ${idx}` }),
    insertedAt: nowISO(),
    updatedAt: nowISO(),
    activeAt: nowISO(),
  }
}

export const resolvers = {
  RootQueryType: {
    ...ticketQueries,
    browserSessions: (_parent, args) =>
      mockPage(
        listAuthSessions(args.browserSessionRef),
        args.pagi,
        `sessions:${args.browserSessionRef}`,
      ),
    me: () => makeUser(),
    sessionState: () => ({ isValid: true, user: makeUser() }),
    docTree: () => ({
      revision: 1,
      treeState: { hasUnpublishedChanges: true, stagedEventCount: 1, revision: 1 },
      stagedEvents: [],
      tabs: [
        {
          id: 'e2e-tab',
          type: 'TAB',
          title: 'Docs',
          index: 0,
          pins: [],
          groups: [
            {
              id: 'e2e-group',
              parentNodeId: 'e2e-tab',
              type: 'GROUP',
              title: 'Guides',
              index: 0,
              pages: [
                {
                  id: 'e2e-page',
                  parentNodeId: 'e2e-group',
                  docId: 'e2e-doc',
                  type: 'PAGE',
                  title: 'Canonical title',
                  index: 0,
                  pages: [],
                  publishState: {
                    status: 'DRAFT',
                    published: false,
                    publishedBefore: false,
                    hasDraft: true,
                    hasUnpublishedChanges: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    }),
    docDraft: () => docDraftState.draft,

    community: (_parent, args) => {
      const slug = args?.slug ?? 'home'
      if (slug === 'home') return HOME_COMMUNITY
      return makeCommunity(slug)
    },
    pagedCommunityModerators: (_parent, args) =>
      mockPage(
        Array.from({ length: 3 }, (_, index) => ({
          id: String(index + 1),
          isRoot: index === 0,
          passportItemCount: index === 0 ? 20 : 2,
          user: makeUser({ login: `moderator_${index}` }),
        })),
        args.pagi,
        `moderators:${args.community}`,
      ),
    moderatorCandidates: () => [],
    postPage: (_parent, args) => {
      const community = args?.filter?.community ?? 'home'
      const entries = Array.from({ length: community === 'home' ? 3 : 2 }, (_, i) =>
        makePost(i + 1, community),
      )
      return { ...mockPage(entries, args.pagi, `posts:${community}`), pinnedEntries: [] }
    },
    commentPage: (_parent, args) => ({
      ...mockPage([], args.pagi, `comments:${JSON.stringify(args.filter ?? {})}`),
      pinnedEntries: [],
    }),
    commentReplyPage: (_parent, args) => mockPage([], args.pagi, `replies:${args.commentId}`),
  },
  RootMutationType: {
    ...ticketMutations,
    updateDocDraft: (_parent, args) => {
      docDraftState.calls += 1
      const receipt = docDraftState.receipts.get(args.commandId)
      if (receipt) return receipt
      if (docDraftState.scenario === 'conflict')
        throw new GraphQLError('draft version conflict', { extensions: { code: 4539 } })
      if (docDraftState.scenario === 'rate_limit_then_success' && docDraftState.calls === 1)
        throw new GraphQLError('rate limited', { extensions: { code: 'RATE_LIMITED' } })

      const next = {
        ...docDraftState.draft,
        version: docDraftState.draft.version + 1,
        title: args.title ?? docDraftState.draft.title,
        subtitle: args.subtitle ?? docDraftState.draft.subtitle,
        slug: args.slug ?? docDraftState.draft.slug,
        digest: args.subtitle ?? docDraftState.draft.digest,
        updatedAt: nowISO(),
        body: args.bodyBag
          ? {
              json: args.bodyBag.json,
              markdown: args.bodyBag.markdown,
              toc: args.bodyBag.toc,
              html: args.bodyBag.html,
            }
          : docDraftState.draft.body,
      }
      docDraftState.draft = next
      docDraftState.receipts.set(args.commandId, next)
      return next
    },
    refreshBrowserSession: (_parent, args) => refreshAuthSession(args.browserSessionRef),
    revokeBrowserSession: (_parent, args) => revokeAuthSession(args.browserSessionRef),
    revokeBrowserSessionPublic: (_parent, args) =>
      revokeAuthSessionPublic(args.browserSessionRef, args.publicRef),
    revokeOtherBrowserSessions: (_parent, args) => revokeOtherAuthSessions(args.browserSessionRef),
    signinOauth: (_parent, args) => createAuthSession(args.provider, args.browserSession),
  },
}

export const mocks = {
  // Avoid @graphql-tools/mock default "Hello World" everywhere.
  // Also reduces duplicate React keys when some list uses string fields as keys.
  String: () => nextMockString(),
  DateTime: () => nowISO(),
  Date: () => todayISO(),
  Json: () => ({}),
}
