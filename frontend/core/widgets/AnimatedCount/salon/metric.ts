import SIZE from '~/const/size'
import type { TSize } from '~/spec'

export const getFontSize = (size: TSize): number => {
  switch (size) {
    case SIZE.TINY: {
      return 13
    }
    case SIZE.MEDIUM: {
      return 16
    }
    case SIZE.LARGE: {
      return 26
    }
    case SIZE.HUGE: {
      return 30
    }
    default: {
      return 15
    }
  }
}

export const getFlipNumOffset = (size: TSize): number => {
  switch (size) {
    case SIZE.MEDIUM: {
      return 7
    }
    default: {
      return 6
    }
  }
}
