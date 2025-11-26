/*
 * theme desc
 * TODO: add README in this folder to show some snapshot
 * 参考: http://enrmarc.github.io/atom-theme-gallery/
 * slackUI: https://atom.io/themes/slack-ui
 * Github: ...
 */

import { path, split } from 'ramda'

import type { TFlatThemeKey, TTheme } from '~/spec'

import skinsData from './skins'

export const themeSkins = { ...skinsData }

// curried shorthand for style-components
export const theme = (themeKey: TFlatThemeKey): TTheme => {
  return (path(['theme', ...split('.', themeKey)]) || 'wheat') as TTheme
}
