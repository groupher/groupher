import type { TSizeTSM } from '~/spec'
import SIZE from '~/const/size'

export const getLavaLampScale = (size: TSizeTSM): string => {
  switch (size) {
    case SIZE.SMALL: {
      return 'scale(0.5);'
    }

    case SIZE.MEDIUM: {
      return 'scale(0.8);'
    }

    default: {
      return 'scale(1);'
    }
  }
}

export const holder = 1
