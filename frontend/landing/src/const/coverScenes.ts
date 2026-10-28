import { WALLPAPER_TYPE } from '~/const/wallpaper'

export type TCoverScene = {
  id: string
  label: string
  wallpaperType: WALLPAPER_TYPE
  wallpaperSource: string
  wallpaperImage: string
  wallpaperPreview: string
  wallpaperPanAxis?: 'x' | 'y'
  coverImage: {
    light: string
    dark: string
    alt: string
  }
}

const picture = (name: string) => `/wallpaper/picture/${name}.webp`
const preview = (name: string) => `/wallpaper/picture-preview/${name}.webp`
const gradient = (name: string) => `/landing/wallpaper/${name.replaceAll('_', '-')}.svg`
const currentCoverImage = {
  light: '/landing/intro/home.webp',
  dark: '/landing/intro/home-dark.webp',
  alt: 'Groupher community forum preview',
}

/** Demo wallpaper selections around the original product cover. */
export const COVER_SCENES: readonly TCoverScene[] = [
  {
    id: 'inspiration',
    label: 'Inspire ideas',
    wallpaperType: WALLPAPER_TYPE.PATTERN,
    wallpaperSource: 'backiee-3',
    wallpaperImage: picture('backiee-3'),
    wallpaperPreview: preview('backiee-3'),
    coverImage: { ...currentCoverImage },
  },
  {
    id: 'gaming',
    label: 'Plan a launch',
    wallpaperType: WALLPAPER_TYPE.PATTERN,
    wallpaperSource: 'openscreen-wallpaper14',
    wallpaperImage: picture('openscreen-wallpaper14'),
    wallpaperPreview: preview('openscreen-wallpaper14'),
    coverImage: { ...currentCoverImage },
  },
  {
    id: 'travel',
    label: 'Explore together',
    wallpaperType: WALLPAPER_TYPE.PATTERN,
    wallpaperSource: 'openscreen-wallpaper18',
    wallpaperImage: picture('openscreen-wallpaper18'),
    wallpaperPreview: preview('openscreen-wallpaper18'),
    coverImage: { ...currentCoverImage },
  },
  {
    id: 'hardware',
    label: 'Share updates',
    wallpaperType: WALLPAPER_TYPE.GRADIENT,
    wallpaperSource: 'sky_mauve_blue',
    wallpaperImage: gradient('sky_mauve_blue'),
    wallpaperPreview: gradient('sky_mauve_blue'),
    coverImage: { ...currentCoverImage },
  },
  {
    id: 'feedback',
    label: 'Collect feedback',
    wallpaperType: WALLPAPER_TYPE.GRADIENT,
    wallpaperSource: 'amber_mauve',
    wallpaperImage: '/landing/wallpaper/amber-mauve-wide.webp',
    wallpaperPreview: '/landing/wallpaper/amber-mauve-phone.webp',
    wallpaperPanAxis: 'y',
    coverImage: { ...currentCoverImage },
  },
  {
    id: 'learning',
    label: 'Guide learners',
    wallpaperType: WALLPAPER_TYPE.PATTERN,
    wallpaperSource: 'sw-1',
    wallpaperImage: picture('sw-1'),
    wallpaperPreview: preview('sw-1'),
    coverImage: { ...currentCoverImage },
  },
  {
    id: 'creative',
    label: 'Tell your story',
    wallpaperType: WALLPAPER_TYPE.PATTERN,
    wallpaperSource: 'backiee-6',
    wallpaperImage: picture('backiee-6'),
    wallpaperPreview: preview('backiee-6'),
    coverImage: { ...currentCoverImage },
  },
  {
    id: 'software',
    label: 'Build software',
    wallpaperType: WALLPAPER_TYPE.GRADIENT,
    wallpaperSource: 'stone_green',
    wallpaperImage: gradient('stone_green'),
    wallpaperPreview: gradient('stone_green'),
    coverImage: { ...currentCoverImage },
  },
  {
    id: 'growth',
    label: 'Grow together',
    wallpaperType: WALLPAPER_TYPE.PATTERN,
    wallpaperSource: 'backiee-4',
    wallpaperImage: picture('backiee-4'),
    wallpaperPreview: preview('backiee-4'),
    coverImage: { ...currentCoverImage },
  },
]
