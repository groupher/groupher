export const TAB = {
  PICTURES: 'pictures',
  GRADIENT: 'gradient',
  DIY: 'diy',
  UPLOAD: 'upload',
} as const

export const TAB_OPTIONS = [
  {
    key: TAB.PICTURES,
    labelKey: 'dsb.appearance.wallpaper.editor.tab.pictures',
  },
  {
    key: TAB.GRADIENT,
    labelKey: 'dsb.appearance.wallpaper.editor.tab.gradient',
  },
  {
    key: TAB.DIY,
    labelKey: 'dsb.appearance.wallpaper.editor.tab.diy',
  },
  {
    key: TAB.UPLOAD,
    labelKey: 'dsb.appearance.wallpaper.editor.tab.upload',
  },
] as const
