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

// The light and dark Landing seeds use the same amber_mauve recipe.
const LANDING_STATIC_WALLPAPER = {
  wide: { url: '/landing/wallpaper/amber-mauve-wide.webp', width: 1920, height: 1080 },
  desktop: { url: '/landing/wallpaper/amber-mauve-desktop.webp', width: 1440, height: 900 },
  tablet: { url: '/landing/wallpaper/amber-mauve-tablet.webp', width: 1024, height: 1366 },
  phone: { url: '/landing/wallpaper/amber-mauve-phone.webp', width: 390, height: 844 },
}

export const LANDING_INIT_DATA = {
  community: LANDING_COMMUNITY,
  footerLinks: {
    layout: FOOTER_LAYOUT.GROUP,
    links: [],
    onelineLinks: [],
  },
  wallpaper: {
    wallpaper: {
      version: 1,
      lightSource: 'amber_mauve',
      darkSource: 'amber_mauve',
      light: LANDING_STATIC_WALLPAPER,
      dark: LANDING_STATIC_WALLPAPER,
    },
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
