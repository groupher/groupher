export const TAB = {
  PICTURES: 'pictures',
  GRADIENT: 'gradient',
  UPLOAD: 'upload',
} as const

export const TAB_OPTIONS = [
  {
    title: 'dsb.appearance.wallpaper.editor.tab.pictures',
    slug: TAB.PICTURES,
  },
  {
    title: 'dsb.appearance.wallpaper.editor.tab.gradient',
    slug: TAB.GRADIENT,
  },
  {
    title: 'dsb.appearance.wallpaper.editor.tab.upload',
    slug: TAB.UPLOAD,
  },
] as const
