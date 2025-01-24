/*
 * theme desc
 * TODO: add README in this folder to show some snapshot
 * 参考: http://enrmarc.github.io/atom-theme-gallery/
 * slackUI: https://atom.io/themes/slack-ui
 * Github: ...
 * gruvbox: https://atom.io/themes/gruvbox-syntax
 * Spacegray: https://atom.io/themes/spacegray-dark-neue-syntax
 * DuoTone Dark: https://atom.io/themes/duotone-dark-forest-syntax
 * DuoTone Dark2: https://atom.io/themes/duotone-dark-earth-syntax
 * Earthsung https://atom.io/themes/earthsung-by-jackson-syntax
 */

import { path, split } from 'ramda'

import type { TTheme } from '~/spec'

import type { TFlatThemeKey } from './skins'
import skinsData from './skins'

export const themeSkins = { ...skinsData }

// curried shorthand for style-components
export const theme = (themeKey: TFlatThemeKey): TTheme => {
  return (path(['theme', ...split('.', themeKey)]) || 'wheat') as TTheme
}

export { default as themeMeta } from './theme_meta'
