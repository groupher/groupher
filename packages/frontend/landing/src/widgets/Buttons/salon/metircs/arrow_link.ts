import SIZE from '~/const/size'

export const getTextSize = (size: string): string => {
  switch (size) {
    case SIZE.TINY: {
      return 'text-xs'
    }

    case SIZE.MEDIUM: {
      return 'text-base'
    }

    case SIZE.LARGE: {
      return 'text-lg'
    }

    default: {
      return 'text-sm'
    }
  }
}

export const getIconSize = (size: string): string => {
  switch (size) {
    case SIZE.TINY: {
      return 'size-3'
    }

    case SIZE.MEDIUM: {
      return 'size-4'
    }

    case SIZE.LARGE: {
      return 'size-5'
    }

    default: {
      return 'size-3.5'
    }
  }
}
