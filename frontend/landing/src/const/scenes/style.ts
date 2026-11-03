export type TSceneColor =
  | { kind: 'hex'; value: string }
  | { kind: 'oklch'; lightness: number; chroma: number; hue: number; alpha?: number }
  | {
      kind: 'token'
      name: 'pageBg' | 'cardColor' | 'dividerColor' | 'primaryColor' | 'accentColor'
    }

export type TSceneBackground =
  | { kind: 'inherit' | 'none' }
  | { kind: 'solid'; color: TSceneColor }
  | { kind: 'gradient'; angle: number; stops: readonly { offset: number; color: TSceneColor }[] }
  | { kind: 'image'; asset: `/landing/${string}` | `/wallpaper/${string}`; overlay?: TSceneColor }
  | { kind: 'token'; name: `landing-gradient-${string}` | `gradient-${string}` }

export type TSceneEffect = { kind: 'inherit' | 'none' } | { kind: 'color'; color: TSceneColor }

export type TSceneSurface = {
  background: TSceneBackground
  border?: TSceneEffect
  shadow?: TSceneEffect
}

/** Serializes the background for scene consumers that do not need border or shadow declarations. */
export const sceneSurface = (surface: TSceneSurface): string => sceneBackground(surface.background)

const COLOR_TOKENS = {
  pageBg: '--color-pageBg',
  cardColor: '--color-card',
  dividerColor: '--color-divider',
  primaryColor: '--color-primary-custom',
  accentColor: '--color-accent-custom',
} as const

const validNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error('Invalid scene color value')
  return value
}

/** Converts scene tokens, hex, or OKLCH values to CSS, rejecting invalid colors or numeric ranges. */
export const sceneColor = (color: TSceneColor): string => {
  if (color.kind === 'token') return `var(${COLOR_TOKENS[color.name]})`
  if (color.kind === 'hex') {
    if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color.value)) {
      throw new Error('Invalid scene hex color')
    }
    return color.value
  }
  const l = validNumber(color.lightness, 0, 1)
  const c = validNumber(color.chroma, 0, 0.5)
  const h = validNumber(color.hue, 0, 360)
  const a = validNumber(color.alpha ?? 1, 0, 1)
  return `oklch(${l} ${c} ${h} / ${a})`
}

/** Builds a CSS background from scene colors, tokens, gradients, or validated local image paths. */
export const sceneBackground = (background: TSceneBackground): string => {
  switch (background.kind) {
    case 'inherit':
      return 'transparent'
    case 'none':
      return 'none'
    case 'solid':
      return sceneColor(background.color)
    case 'token': {
      if (!/^(?:landing-gradient|gradient)-[a-z]+$/.test(background.name)) {
        throw new Error('Invalid scene background token')
      }
      return `var(--${background.name})`
    }
    case 'gradient': {
      const angle = validNumber(background.angle, 0, 360)
      if (background.stops.length < 2) throw new Error('Scene gradient needs two stops')
      const stops = background.stops.map(
        ({ offset, color }) => `${sceneColor(color)} ${validNumber(offset, 0, 1) * 100}%`,
      )
      return `linear-gradient(${angle}deg, ${stops.join(', ')})`
    }
    case 'image': {
      if (!/^\/(?:landing|wallpaper)\/[a-zA-Z0-9/_-]+\.(?:webp|png|svg)$/.test(background.asset)) {
        throw new Error('Invalid scene image asset')
      }
      const image = `url("${background.asset}")`
      return background.overlay
        ? `linear-gradient(${sceneColor(background.overlay)}, ${sceneColor(background.overlay)}), ${image}`
        : image
    }
  }
}
