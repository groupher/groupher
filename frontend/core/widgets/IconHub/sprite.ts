export const PROVIDERS = ['fa', 'lucide', 'heroicons', 'phosphor'] as const

export type TIconProvider = (typeof PROVIDERS)[number]

export const getIconSymbolId = (provider: TIconProvider, name: string): string =>
  `${provider}-${name}`

export const getIconFilePath = (provider: TIconProvider, name: string): string =>
  `/icons/${provider}/${name}.svg`

export const getIconSpritePath = (provider: TIconProvider): string =>
  `/icons/${provider}.sprite.svg`

export const getIconSpriteHref = (provider: TIconProvider, name: string): string =>
  `${getIconSpritePath(provider)}#${getIconSymbolId(provider, name)}`
