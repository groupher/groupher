export const TAB = {
  PICTURES: 'pictures',
  GRADIENT: 'gradient',
  UPLOAD: 'upload',
} as const

export const TAB_OPTIONS = [
  {
    labelEn: 'Pictures',
    labelZh: '图片',
    slug: TAB.PICTURES,
  },
  {
    labelEn: 'Gradient',
    labelZh: '渐变',
    slug: TAB.GRADIENT,
  },
  {
    labelEn: 'Upload',
    labelZh: '上传',
    slug: TAB.UPLOAD,
  },
] as const
