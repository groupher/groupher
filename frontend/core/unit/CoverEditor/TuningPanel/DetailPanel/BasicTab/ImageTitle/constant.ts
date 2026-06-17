export const IMAGE_TITLE = {
  primary: 'Primary image',
  secondary: 'Secondary image',
} as const

export type TImageType = keyof typeof IMAGE_TITLE
