import { DSB_ROUTE } from '~/const/route'
import { THREAD } from '~/const/thread'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TBgPattern } from '~/lib/bg/spec'
import type { TPublishedWallpaper, TResolvedThemePreset } from '~/spec'

import type { TSceneBackground, TSceneSurface } from './style'

export const LANDING_COVER_IMAGE = {
  light: '/landing/intro/home.webp',
  dark: '/landing/intro/home-dark.webp',
  alt: 'Groupher community forum preview',
}

type TLandingAssetRef = `/landing/${string}` | `/wallpaper/${string}`

/** Resolves a bundled wallpaper picture name to its full-size image path. */
export const picture = (name: string): TLandingAssetRef => `/wallpaper/picture/${name}.webp`
/** Resolves the bundled thumbnail path used when previewing a wallpaper picture. */
export const preview = (name: string): TLandingAssetRef => `/wallpaper/picture-preview/${name}.webp`
/** Maps a gradient name to its bundled SVG, normalizing underscores in asset names. */
export const gradient = (name: string): TLandingAssetRef =>
  `/landing/wallpaper/${name.replaceAll('_', '-')}.svg`
/** Reuses one 1920×1080 image descriptor across the scene's wallpaper viewport profiles. */
export const publishedProfiles = (url: string): NonNullable<TPublishedWallpaper['light']> => {
  const image = { url, width: 1920, height: 1080 }
  return { wide: image, desktop: image, tablet: image, phone: image }
}

type TLandingWallpaper = {
  type: WALLPAPER_TYPE
  source: string
  assets: NonNullable<TPublishedWallpaper['light']>
  preview: TLandingAssetRef
  cover: TLandingAssetRef
  pattern?: TBgPattern
}

export type TArticleTab =
  | typeof THREAD.POST
  | typeof THREAD.KANBAN
  | typeof THREAD.CHANGELOG
  | typeof THREAD.DOC
export type TDashboardTab =
  | typeof DSB_ROUTE.APPEARANCE
  | typeof DSB_ROUTE.POST
  | typeof DSB_ROUTE.TAGS
  | typeof DSB_ROUTE.CLASSIC
  | typeof DSB_ROUTE.ADMINS
  | typeof DSB_ROUTE.SEO
  | typeof DSB_ROUTE.INOUT
  | typeof DSB_ROUTE.WIDGETS
  | typeof DSB_ROUTE.ANALYSIS
export type TBatteryCard =
  | 'bundleSize'
  | 'mobileFirst'
  | 'darkMode'
  | 'security'
  | 'richContent'
  | 'integration'
  | 'design'
  | 'statistics'

type TTabbedSurface<T extends string> = {
  default: TSceneSurface
  byTab: Partial<Record<T, TSceneSurface>>
}
type TCardSurfaces<T extends string> = {
  default: TSceneSurface
  byCard: Partial<Record<T, TSceneSurface>>
}

type TSceneDetails = {
  coverDeviceShadow: string
  coverRailBorder: string
  coverRailBg: string
  coverRailOverlay: string
  coverGradientOverlay: string
  coverFocus: string
  coverLabel: string
  coverStageBorder: string
  coverStageBg: string
  coverStageShadow: string
  comparePositive: string
  compareNegative: string
  compareStripes: string
  paperPunch: string
  keyboardWall: string
  keyboardStart: string
  keyboardEnd: string
}

type TAppearance = {
  page: TSceneSurface
  opening: TSceneSurface
  sections: {
    cover: TSceneSurface
    articles: TTabbedSurface<TArticleTab>
    dashboard: TTabbedSurface<TDashboardTab>
    battery: TCardSurfaces<TBatteryCard>
    compare: TSceneSurface & { positive: TSceneBackground }
    users: TSceneSurface
    join: TSceneSurface
    footer: TSceneSurface
  }
  /** Existing local decoration values; scoped to Landing and mode. */
  surfaces: TSceneDetails
}

const surface = (background: TSceneBackground): TSceneSurface => ({ background })
const inherited = () => surface({ kind: 'inherit' })
const token = (name: `landing-gradient-${string}` | `gradient-${string}`) =>
  surface({ kind: 'token', name })

const defaultAppearance = (dark: boolean): TAppearance => ({
  page: inherited(),
  opening: inherited(),
  surfaces: {
    coverDeviceShadow: '0 12px 32px rgb(38 35 56 / 10%)',
    coverRailBorder: 'rgb(255 255 255 / 52%)',
    coverRailBg: '#f7f7f7',
    coverRailOverlay:
      'linear-gradient(rgb(255 255 255 / 15%), rgb(255 255 255 / 18%) 60%, rgb(255 255 255 / 35%))',
    coverGradientOverlay: 'linear-gradient(rgb(255 255 255 / 5%), rgb(255 255 255 / 10%))',
    coverFocus: '#6461a7',
    coverLabel: '#302b36',
    coverStageBorder: 'rgb(255 255 255 / 75%)',
    coverStageBg: '#f8f6f8',
    coverStageShadow: '0 24px 60px rgb(24 28 38 / 20%)',
    comparePositive: dark ? '#314228c9' : '#eaffdfc9',
    compareNegative: dark ? '#823a3a7d' : '#ffa5a57d',
    compareStripes: dark
      ? 'repeating-linear-gradient(245deg, #352424 0 10px, #0000 10px 20px)'
      : 'repeating-linear-gradient(245deg, #ffecec 0 10px, transparent 10px 20px)',
    paperPunch: dark ? '#323232' : '#e9e9e9',
    keyboardWall: dark ? '#181818' : '#1d1d1d',
    keyboardStart: dark ? '#2d2c2c' : '#232323',
    keyboardEnd: dark ? '#212121' : '#181818',
  },
  sections: {
    cover: inherited(),
    articles: {
      default: inherited(),
      byTab: {
        [THREAD.POST]: token('landing-gradient-purple'),
        [THREAD.KANBAN]: token('landing-gradient-blue'),
        [THREAD.CHANGELOG]: token('landing-gradient-red'),
        [THREAD.DOC]: token('landing-gradient-cyan'),
      },
    },
    dashboard: {
      default: inherited(),
      byTab: {
        [DSB_ROUTE.APPEARANCE]: token('landing-gradient-purple'),
        [DSB_ROUTE.POST]: token('landing-gradient-blue'),
        [DSB_ROUTE.TAGS]: token('landing-gradient-green'),
        [DSB_ROUTE.CLASSIC]: token('landing-gradient-brown'),
        [DSB_ROUTE.ADMINS]: token('landing-gradient-red'),
        [DSB_ROUTE.SEO]: token('landing-gradient-cyan'),
        [DSB_ROUTE.INOUT]: token('landing-gradient-yellow'),
      },
    },
    battery: {
      default: inherited(),
      byCard: {
        bundleSize: token('gradient-purple'),
        mobileFirst: token('gradient-brown'),
        darkMode: token('gradient-cyan'),
        security: token('gradient-green'),
        richContent: token('gradient-blue'),
        integration: token('gradient-pink'),
        design: token('gradient-black'),
        statistics: token('gradient-orange'),
      },
    },
    compare: { ...inherited(), positive: { kind: 'token', name: 'gradient-green' } },
    users: token('landing-gradient-gray'),
    join: inherited(),
    footer: inherited(),
  },
})

export const BASE_APPEARANCE = {
  light: defaultAppearance(false),
  dark: defaultAppearance(true),
}

export const BASE_THEME_PRESET: TResolvedThemePreset = {
  shared: { glowFixed: false },
  light: {
    pageBg: '#ffffff',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#333333',
    accentColor: '#333333',
    textTitle: '#333333',
    textDigest: '#767789',
    cardColor: '#ffffff',
    dividerColor: '#eae9e9',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 0,
  },
  dark: {
    pageBg: '#212121',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#333333',
    accentColor: '#333333',
    textTitle: '#f5f5f5',
    textDigest: '#949494',
    cardColor: '#252525',
    dividerColor: '#4f4b4b',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 0,
  },
}

export type TLandingScene = {
  id: string
  label: string
  wallpaperPanAxis?: 'x' | 'y'
  themePreset: TResolvedThemePreset
  appearance: { light: TAppearance; dark: TAppearance }
  wallpaper: {
    light: TLandingWallpaper
    dark: TLandingWallpaper
  }
}

/** Validates local preview and cover paths in both modes, throwing for invalid scene assets. */
export const defineScene = (scene: TLandingScene): TLandingScene => {
  for (const mode of ['light', 'dark'] as const) {
    for (const asset of [scene.wallpaper[mode].preview, scene.wallpaper[mode].cover]) {
      if (!/^\/(?:landing|wallpaper)\/[a-zA-Z0-9/_-]+\.(?:webp|png|svg)$/.test(asset)) {
        throw new Error(`Invalid Landing Scene ${mode} asset: ${scene.id}`)
      }
    }
  }
  return scene
}
