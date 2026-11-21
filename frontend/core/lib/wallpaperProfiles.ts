/**
 * Responsive Wallpaper export profiles.
 *
 * A profile is a viewport composition, while a variant is one immutable image
 * generated for that composition. Keep this module free of editor/store
 * dependencies so Phoenix and future export adapters can mirror the same keys.
 */

import { lowerEnumValue, valueKeyedEnum } from '~/lib/enumValues'
import { WallpaperProfile } from '~/lib/graphql/generated/enums'

export type TWallpaperProfile = Lowercase<WallpaperProfile>

const PROFILE_VALUES = valueKeyedEnum(WallpaperProfile)
const WIDE = lowerEnumValue(PROFILE_VALUES.WIDE)
const DESKTOP = lowerEnumValue(PROFILE_VALUES.DESKTOP)
const TABLET = lowerEnumValue(PROFILE_VALUES.TABLET)
const PHONE = lowerEnumValue(PROFILE_VALUES.PHONE)

export type TWallpaperProfileSpec = {
  key: TWallpaperProfile
  logicalWidth: number
  logicalHeight: number
  mediaQuery: string
}

export type TWallpaperVariantSpec = {
  key: string
  profile: TWallpaperProfile
  width: number
  height: number
  format: 'webp'
  quality: number
}

/** Version the static consumer uses when validating a complete profile matrix. */
export const WALLPAPER_PROFILE_VERSION = 1

/**
 * Initial profile matrix. The dimensions are deliberately explicit: renderers
 * must compose each aspect ratio independently instead of cropping one master
 * bitmap into several device shapes.
 */
export const WALLPAPER_PROFILE_SPECS: readonly TWallpaperProfileSpec[] = [
  {
    key: WIDE,
    logicalWidth: 1920,
    logicalHeight: 1080,
    mediaQuery: '(min-width: 1440px) and (min-aspect-ratio: 16/10)',
  },
  {
    key: DESKTOP,
    logicalWidth: 1440,
    logicalHeight: 900,
    mediaQuery: '(min-width: 1024px) and (max-aspect-ratio: 16/10)',
  },
  {
    key: TABLET,
    logicalWidth: 1024,
    logicalHeight: 1366,
    mediaQuery: '(min-width: 768px) and (max-width: 1023px)',
  },
  {
    key: PHONE,
    logicalWidth: 390,
    logicalHeight: 844,
    mediaQuery: '(max-width: 767px)',
  },
] as const

export const WALLPAPER_VARIANT_SPECS: readonly TWallpaperVariantSpec[] =
  WALLPAPER_PROFILE_SPECS.map(({ key, logicalWidth, logicalHeight }) => ({
    key,
    profile: key,
    width: logicalWidth,
    height: logicalHeight,
    format: 'webp',
    quality: 0.86,
  }))

/** Resolves a named responsive Wallpaper profile for media-query consumers. */
export const wallpaperProfileSpec = (profile: TWallpaperProfile): TWallpaperProfileSpec => {
  const spec = WALLPAPER_PROFILE_SPECS.find((item) => item.key === profile)
  if (!spec) throw new Error(`WALLPAPER_PROFILE_UNKNOWN: ${profile}`)
  return spec
}

/** Mirrors the StaticWallpaper media-query cascade for runtime renderers. */
export const resolveWallpaperProfile = (
  viewportWidth: number,
  viewportHeight: number,
): TWallpaperProfile => {
  if (viewportWidth <= 767) return PHONE
  if (viewportWidth <= 1023) return TABLET

  const aspectRatio = viewportWidth / Math.max(1, viewportHeight)
  return aspectRatio <= 16 / 10 ? DESKTOP : WIDE
}

/** Returns the immutable responsive Wallpaper variant matrix for one theme. */
export const wallpaperVariantSpecs = (theme: 'light' | 'dark'): readonly TWallpaperVariantSpec[] =>
  WALLPAPER_VARIANT_SPECS.map((variant) => ({
    ...variant,
    key: `${theme}-${variant.key}`,
  }))

export type TNormalizedPoint = { x: number; y: number }
export type TNormalizedRect = { x: number; y: number; width: number; height: number }

export type TWallpaperFraming =
  | { mode: 'crop'; rect: TNormalizedRect }
  | { mode: 'focal'; point: TNormalizedPoint; zoom: number }

export type TWallpaperSource = {
  assetPublicRef: string
  width: number
  height: number
  mime: string
}

export type TWallpaperProfileAuthoringConfig = {
  sourceOverride?: TWallpaperSource
  framing?: TWallpaperFraming
}

/** Returns the deterministic center-cover default used by Editor and Export. */
export const resolveWallpaperFraming = (framing?: TWallpaperFraming): TWallpaperFraming =>
  framing ?? {
    mode: 'focal',
    point: { x: 0.5, y: 0.5 },
    zoom: 1,
  }
