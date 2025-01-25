export const mediaBreakPoints = {
  // mobileS: '320px',
  // mobileM: '375px',
  mobile: 576,
  tablet: 768,
  laptop: 992,
  laptopM: 1280,
  laptopL: 1400,
  maxContent: 1520, // WIDTH.COMMUNITY.PAGE
  desktop: 1600,
  // currently used as forms of drawer content (slideout/modal)
  desktopL: 1920,
}

// PAGE: 页面宽度 (不包括背景图) for footer, header etc
// CONTENT: 内容宽度
//   #fafaf9
export const WIDTH = {
  HOME: {
    PAGE: '1460px',
    CONTENT: '1180px',
  },
  COMMUNITY: {
    PAGE: '1200px',
    CONTENT: '960px',
    CONTENT_OFFSET: '40px',
  },
  APPLY_COMMUNITY: {
    PAGE: '1200px',
    CONTENT: '960px',
    CONTENT_OFFSET: '40px',
  },
  COMMUNITY_SIDEBAR: {
    PAGE: '1360px',
    CONTENT: '1180px',
    CONTENT_OFFSET: '0',
  },
  DOC: {
    PAGE: '1360px',
    CONTENT: '1020px',
  },
  DASHBOARD: {
    PAGE: '1380px',
    CONTENT: '1060px',
  },
  USER: {
    PAGE: '1380px',
    CONTENT: '1024px',
  },
  EXPLORE: {
    CONTENT: '1100px',
  },
  ARTICLE: {
    PAGE: '1320px',
    CONTENT: '860px',
    CONTENT_OFFSET: '18px',
    // CONTENT_OFFSET_LAPTOPL: '50px',
    // CONTENT_OFFSET_DESKTOPL: '50px',
    // STICKER: '240px',
    // STICKER_LAPTOPL: '220px',
  },
  CHANGELOG_ARTICLE: {
    PAGE: '1320px',
    CONTENT: '860px',
    CONTENT_OFFSET: '18px',
  },
  BLOG_ARTICLE: {
    PAGE: '1460px',
    CONTENT: '630px',
    CONTENT_OFFSET: '290px',
    CONTENT_OFFSET_LAPTOPL: '260px',
    CONTENT_OFFSET_DESKTOPL: '400px',
    STICKER: '260px',
    STICKER_LAPTOPL: '240px',
  },

  MEMBERSHIP: {
    CONTENT: '1080px',
  },

  ARTICLE_EDITOR: {
    PAGE: '1460px',
    CONTENT: '1024px',
  },

  HELP_CENTER: {
    PAGE: '1460px',
    CONTENT: '1024px',
    CONTENT_OFFSET: '10px',
  },
}
