import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { normalizePersistedAngle } from '~/lib/angle'
import type { CustomWallpaperType, WallpaperType } from '~/lib/graphql/generated/graphql'
import { GRADIENT_RENDERER, GRADIENT_SHAPE, MESH_GRADIENT_RENDERERS } from '~/lib/wallpaperMesh'
import type { TCustomWallpaper } from '~/spec'
import type { TWallpaperThemeState } from '~/stores/wallpaper/spec'

export const WALLPAPER_SETTINGS_SCHEMA_VERSION = 1

type TRenderableWallpaperType = Exclude<TWallpaperThemeState['type'], typeof WALLPAPER_TYPE.NONE>

export type TWallpaperSettings =
  | { type: typeof WALLPAPER_TYPE.NONE }
  | (Omit<TWallpaperThemeState, 'type'> & { type: TRenderableWallpaperType })

export type TWallpaperSettingsTransport = {
  settingsSchemaVersion: number
  type: WallpaperType
  source: string | null
  customWallpaper: TCustomWallpaperTransport | null
  renderConfig: Record<string, unknown> | null
}

export type TWallpaperSettingsInput = {
  settingsSchemaVersion: number
  type: TWallpaperSettingsTransport['type']
  source: string | null
  customWallpaper: TCustomWallpaperInput | null
  renderConfig: string | null
}

type TCustomWallpaperTransport = {
  type: CustomWallpaperType
  assetPublicRef: string | null
  config: unknown
}

type TCustomWallpaperInput = {
  type: TCustomWallpaperTransport['type']
  assetPublicRef: string | null
  config: string
}

type TCustomWallpaperValue = Exclude<TCustomWallpaper, null>

const RENDER_CONFIG_KEYS = ['pattern', 'gradient', 'texture', 'effect'] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isNumberList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => isFiniteNumber(item))

const hasOnlyKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean => {
  const keys = Object.keys(value)
  const allowed = new Set([...required, ...optional])

  return (
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    keys.every((key) => allowed.has(key))
  )
}

const isGradientCenter = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ['x', 'y']) &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y)

const isGradientRecipe = (value: unknown): boolean => {
  if (!isRecord(value) || value.version !== 2 || typeof value.preset !== 'string') return false
  if (!isStringList(value.colors)) return false

  switch (value.renderer) {
    case GRADIENT_RENDERER.LINEAR:
      return (
        hasOnlyKeys(
          value,
          ['version', 'renderer', 'preset', 'colors', 'angle', 'spread'],
          ['stops'],
        ) &&
        isFiniteNumber(value.angle) &&
        isFiniteNumber(value.spread) &&
        (value.stops === undefined || isNumberList(value.stops))
      )
    case GRADIENT_RENDERER.RADIAL:
      return (
        hasOnlyKeys(
          value,
          ['version', 'renderer', 'preset', 'colors', 'center', 'radius', 'shape', 'spread'],
          ['angle', 'stops'],
        ) &&
        isGradientCenter(value.center) &&
        isFiniteNumber(value.radius) &&
        (value.shape === GRADIENT_SHAPE.CIRCLE || value.shape === GRADIENT_SHAPE.ELLIPSE) &&
        isFiniteNumber(value.spread) &&
        (value.angle === undefined || isFiniteNumber(value.angle)) &&
        (value.stops === undefined || isNumberList(value.stops))
      )
    case GRADIENT_RENDERER.FLOW:
    case GRADIENT_RENDERER.LIQUID:
      return (
        MESH_GRADIENT_RENDERERS.includes(value.renderer) &&
        hasOnlyKeys(value, [
          'version',
          'renderer',
          'preset',
          'seed',
          'colors',
          'angle',
          'softness',
          'warp',
          'scale',
          'contrast',
          'brightness',
        ]) &&
        isFiniteNumber(value.seed) &&
        isFiniteNumber(value.angle) &&
        isFiniteNumber(value.softness) &&
        isFiniteNumber(value.warp) &&
        isFiniteNumber(value.scale) &&
        isFiniteNumber(value.contrast) &&
        isFiniteNumber(value.brightness)
      )
    default:
      return false
  }
}

const normalizeCustomWallpaper = (
  customWallpaper: TWallpaperThemeState['customWallpaper'],
): TWallpaperThemeState['customWallpaper'] => {
  if (!customWallpaper) return null

  if (customWallpaper.type === 'picture') {
    return {
      ...customWallpaper,
      assetPublicRef: customWallpaper.assetPublicRef ?? null,
    }
  }

  return { ...customWallpaper }
}

/**
 * Produces the canonical single-theme settings value used for comparison and persistence.
 *
 * NONE intentionally drops every other field so stale render configuration cannot affect
 * equality, history, or request digests.
 */
export const normalizeWallpaperSettings = (settings: TWallpaperThemeState): TWallpaperSettings => {
  if (settings.type === WALLPAPER_TYPE.NONE) return { type: WALLPAPER_TYPE.NONE }

  return {
    assetPublicRef: settings.assetPublicRef ?? null,
    customWallpaper: normalizeCustomWallpaper(settings.customWallpaper),
    effect: { ...settings.effect },
    gradient: settings.gradient
      ? {
          ...settings.gradient,
          angle: normalizePersistedAngle(settings.gradient.angle ?? 0),
        }
      : null,
    pattern: { ...settings.pattern },
    source: settings.source,
    texture: { ...settings.texture, params: { ...settings.texture.params } },
    type: settings.type,
  }
}

const customWallpaperConfig = (value: TCustomWallpaperValue): Record<string, unknown> => {
  const { type: _type, ...withoutType } = value

  if ('assetPublicRef' in withoutType) {
    const { assetPublicRef: _assetPublicRef, ...config } = withoutType
    return config
  }

  return withoutType
}

const encodeCustomWallpaper = (
  customWallpaper: TWallpaperThemeState['customWallpaper'],
): TCustomWallpaperInput | null => {
  if (!customWallpaper) return null

  return {
    assetPublicRef:
      customWallpaper.type === 'picture' ? (customWallpaper.assetPublicRef ?? null) : null,
    config: JSON.stringify(customWallpaperConfig(customWallpaper)),
    type: customWallpaper.type === 'picture' ? 'PICTURE' : 'GRADIENT',
  }
}

const decodeJsonLeaf = (value: unknown, field: string): Record<string, unknown> => {
  if (isRecord(value)) return value

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (isRecord(parsed)) return parsed
    } catch {
      // Fall through to the field-specific error below.
    }
  }

  throw new Error(`WALLPAPER_SETTINGS_INVALID: ${field} must be a JSON object`)
}

const encodeType = (type: TRenderableWallpaperType): TWallpaperSettingsTransport['type'] => {
  switch (type) {
    case WALLPAPER_TYPE.PATTERN:
      return 'PICTURE'
    case WALLPAPER_TYPE.GRADIENT:
      return 'GRADIENT'
    case WALLPAPER_TYPE.UPLOAD:
      return 'UPLOAD'
  }
}

/** Encodes one normalized theme into the GraphQL settings envelope. */
export const encodeWallpaperSettings = (
  settings: TWallpaperThemeState,
): TWallpaperSettingsInput => {
  const normalized = normalizeWallpaperSettings(settings)

  if (normalized.type === WALLPAPER_TYPE.NONE) {
    return {
      customWallpaper: null,
      renderConfig: null,
      settingsSchemaVersion: WALLPAPER_SETTINGS_SCHEMA_VERSION,
      source: null,
      type: 'NONE',
    }
  }

  const renderConfig = {
    effect: normalized.effect,
    gradient: normalized.gradient,
    pattern: normalized.pattern,
    texture: normalized.texture,
  }

  return {
    customWallpaper: encodeCustomWallpaper(normalized.customWallpaper),
    renderConfig: JSON.stringify(renderConfig),
    settingsSchemaVersion: WALLPAPER_SETTINGS_SCHEMA_VERSION,
    source: normalized.source,
    type: encodeType(normalized.type),
  }
}

const decodeCustomWallpaper = (
  customWallpaper: TCustomWallpaperTransport | null,
): TWallpaperThemeState['customWallpaper'] => {
  if (!customWallpaper) return null
  const config = decodeJsonLeaf(customWallpaper.config, 'customWallpaper.config')

  if (customWallpaper.type === 'PICTURE') {
    return {
      ...config,
      assetPublicRef: customWallpaper.assetPublicRef,
      type: 'picture',
    } as TWallpaperThemeState['customWallpaper']
  }

  if (customWallpaper.type === 'GRADIENT' && customWallpaper.assetPublicRef === null) {
    return { ...config, type: 'gradient' } as TWallpaperThemeState['customWallpaper']
  }

  throw new Error('WALLPAPER_SETTINGS_INVALID: customWallpaper branch is invalid')
}

const decodeType = (type: TWallpaperSettingsTransport['type']): TRenderableWallpaperType => {
  switch (type) {
    case 'PICTURE':
      return WALLPAPER_TYPE.PATTERN
    case 'GRADIENT':
      return WALLPAPER_TYPE.GRADIENT
    case 'UPLOAD':
      return WALLPAPER_TYPE.UPLOAD
    default:
      throw new Error(`WALLPAPER_SETTINGS_INVALID: unsupported type ${type}`)
  }
}

const decodeRenderConfig = (value: unknown): TWallpaperThemeState => {
  const config = decodeJsonLeaf(value, 'renderConfig')
  const keys = Object.keys(config).sort()
  const expectedKeys = [...RENDER_CONFIG_KEYS].sort()

  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    !isRecord(config.pattern) ||
    !isRecord(config.effect) ||
    !isRecord(config.texture) ||
    (config.gradient !== null && !isRecord(config.gradient)) ||
    (config.gradient !== null && !isGradientRecipe(config.gradient))
  ) {
    throw new Error('WALLPAPER_SETTINGS_INVALID: renderConfig shape is invalid')
  }

  return config as TWallpaperThemeState
}

/**
 * Decodes a GraphQL settings envelope into the existing renderer/store shape.
 * Unknown versions and malformed JSON are hard errors; no frontend default is inserted here.
 */
export const decodeWallpaperSettings = (input: TWallpaperSettingsTransport): TWallpaperSettings => {
  if (input.settingsSchemaVersion !== WALLPAPER_SETTINGS_SCHEMA_VERSION) {
    throw new Error(
      `WALLPAPER_SETTINGS_UNSUPPORTED_VERSION: ${String(input.settingsSchemaVersion)}`,
    )
  }

  if (input.type === 'NONE') {
    if (input.source !== null || input.customWallpaper !== null || input.renderConfig !== null) {
      throw new Error('WALLPAPER_SETTINGS_INVALID: NONE must not carry render configuration')
    }

    return { type: WALLPAPER_TYPE.NONE }
  }

  if (input.source === null) {
    throw new Error('WALLPAPER_SETTINGS_INVALID: source is required for a renderable type')
  }

  const renderConfig = decodeRenderConfig(input.renderConfig)
  const customWallpaper = decodeCustomWallpaper(input.customWallpaper)

  return {
    ...renderConfig,
    assetPublicRef:
      customWallpaper?.type === 'picture' ? (customWallpaper.assetPublicRef ?? null) : null,
    customWallpaper,
    source: input.source,
    type: decodeType(input.type),
  }
}
