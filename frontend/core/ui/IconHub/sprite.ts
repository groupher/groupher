export const PROVIDERS = ['fa', 'lucide', 'heroicons', 'phosphor'] as const

export type TIconProvider = (typeof PROVIDERS)[number]
export type TMarkerIconProvider = TIconProvider | 'dev'

/** Returns icon symbol id for the frontend shared workflow. */
export const getIconSymbolId = (provider: TIconProvider, name: string): string =>
  `${provider}-${name}`

/** Returns icon file path for the frontend shared workflow. */
export const getIconFilePath = (provider: TIconProvider, name: string): string =>
  `/icons/${provider}/${name}.svg`

/** Returns icon sprite path for the frontend shared workflow. */
export const getIconSpritePath = (provider: TIconProvider): string =>
  `/icons/${provider}.sprite.svg`

/** Returns icon sprite href for the frontend shared workflow. */
export const getIconSpriteHref = (provider: TIconProvider, name: string): string =>
  `${getIconSpritePath(provider)}#${getIconSymbolId(provider, name)}`
