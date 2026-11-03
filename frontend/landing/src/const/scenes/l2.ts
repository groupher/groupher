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
  id: 'travel',
  label: 'Explore together',
  themePreset: BASE_THEME_PRESET,
  appearance: BASE_APPEARANCE,
  wallpaper: {
    light: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'openscreen-wallpaper18',
      assets: publishedProfiles(picture('openscreen-wallpaper18')),
      preview: preview('openscreen-wallpaper18'),
      cover: picture('openscreen-wallpaper18'),
    },
    dark: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'openscreen-wallpaper18',
      assets: publishedProfiles(picture('openscreen-wallpaper18')),
      preview: preview('openscreen-wallpaper18'),
      cover: picture('openscreen-wallpaper18'),
    },
  },
})
