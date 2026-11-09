import { WALLPAPER_TYPE } from '~/const/wallpaper'

import {
  BASE_APPEARANCE,
  BASE_THEME_PRESET,
  defineScene,
  publishedProfiles,
  picture,
  preview,
} from './shared'

export default defineScene({
  id: 'learning',
  label: 'Guide learners',
  themePreset: BASE_THEME_PRESET,
  appearance: BASE_APPEARANCE,
  wallpaper: {
    light: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'sw-1',
      assets: publishedProfiles(picture('sw-1')),
      preview: preview('sw-1'),
      cover: picture('sw-1'),
    },
    dark: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'sw-1',
      assets: publishedProfiles(picture('sw-1')),
      preview: preview('sw-1'),
      cover: picture('sw-1'),
    },
  },
})
