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

import type { TFlattenObjectKeys } from '~/spec'

import light from './light'
import dark from './dark'

const skinsData = {
  light,
  dark,
}

// see https://www.raygesualdo.com/posts/flattening-object-keys-with-typescript-types
export type TFlatThemeKey = TFlattenObjectKeys<typeof light>

export default skinsData
