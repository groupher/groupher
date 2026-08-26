import { FOOTER_LAYOUT } from '~/const/layout'
import { DEFAULT_WALLPAPER_PATTERN_ID, WALLPAPER_PATTERN_TONE } from '~/const/wallpaper'

export { BUILTIN_ALIAS } from './builtin-alias'

const LANDING_WALLPAPER_PATTERN_INTENSITY = 16

export const HOME_COMMUNITY = {
  home: 'groupher',
  slug: 'home',
  logo: '/groupher.png',
}

const LANDING_COMMUNITY = {
  slug: 'landing',
  homepage: '',
  desc: '',
  meta: { postsCount: 0, docsCount: 0, blogsCount: 0, changelogsCount: 0 },
  // dashboard: {
  //   ...FIELDS,
  //   original: FIELDS,
  // },
}

export const LANDING_INIT_DATA = {
  community: LANDING_COMMUNITY,
  footerLinks: {
    layout: FOOTER_LAYOUT.GROUP,
    links: [],
    onelineLinks: [],
  },
  wallpaper: {
    light: {
      pattern: {
        enabled: true,
        id: DEFAULT_WALLPAPER_PATTERN_ID,
        intensity: LANDING_WALLPAPER_PATTERN_INTENSITY,
        tone: WALLPAPER_PATTERN_TONE.DARK,
      },
    },
    dark: {
      pattern: {
        enabled: true,
        id: DEFAULT_WALLPAPER_PATTERN_ID,
        intensity: LANDING_WALLPAPER_PATTERN_INTENSITY,
        tone: WALLPAPER_PATTERN_TONE.DARK,
      },
    },
  },
}
