export const getFontSize = (size: number): string => {
  if (size <= 4) {
    return 'text-xs'
  }
  if (size > 5 && size <= 8) {
    return 'text-sm'
  }

  return 'text-lg'
}

export const holder = 1
