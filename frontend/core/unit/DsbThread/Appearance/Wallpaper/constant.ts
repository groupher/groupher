export enum TAB {
  PICTURES = 'pictures',
  GRADIENT = 'gradient',
  UPLOAD = 'upload',
}

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
    key: TAB.UPLOAD,
    labelKey: 'dsb.appearance.wallpaper.editor.tab.upload',
  },
] as const
