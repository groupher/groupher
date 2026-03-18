import SIZE from '~/const/size'
import type { TSizeTSM } from '~/spec'

export const getIconSize = (size: TSizeTSM): number => {
  switch (size) {
    case SIZE.MEDIUM: {
      return 3
    }

    default: {
      return 2.5
    }
  }
}

export const getDotMargin = (size: TSizeTSM): number => {
  switch (size) {
    case SIZE.MEDIUM: {
      return 6
    }

    default: {
      return 4
    }
  }
}

export const getHashMargin = (size: TSizeTSM): number => {
  switch (size) {
    case SIZE.MEDIUM: {
      return 2
    }

    default: {
      return 0.5
    }
  }
}

export const getDotSize = (size: TSizeTSM): number => {
  switch (size) {
    case SIZE.MEDIUM: {
      return 3
    }

    default: {
      return 2
    }
  }
}
