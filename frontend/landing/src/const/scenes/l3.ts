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
  id: 'gaming',
  label: 'Plan a launch',
  themePreset: BASE_THEME_PRESET,
  appearance: BASE_APPEARANCE,
  wallpaper: {
    light: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'openscreen-wallpaper14',
      assets: publishedProfiles(picture('openscreen-wallpaper14')),
      preview: preview('openscreen-wallpaper14'),
      cover: picture('openscreen-wallpaper14'),
    },
    dark: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'openscreen-wallpaper14',
      assets: publishedProfiles(picture('openscreen-wallpaper14')),
      preview: preview('openscreen-wallpaper14'),
      cover: picture('openscreen-wallpaper14'),
    },
  },
})
