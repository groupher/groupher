export const TAB = {
  BUILD_IN: 'build_in',
  UPLOAD: 'upload',
} as const

export const TAB_OPTIONS = [
  {
    title: '内置壁纸',
    slug: TAB.BUILD_IN,
  },
  {
    title: '上传壁纸',
    slug: TAB.UPLOAD,
  },
] as const
