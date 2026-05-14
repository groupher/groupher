import SIZE from '~/const/size'

export const getSlipMargin = (size: string, mobileView: boolean): number => {
  if (mobileView) return 5

  switch (size) {
    case SIZE.SMALL: {
      return 0
    }

    case SIZE.MEDIUM: {
      return 0
    }

    default:
      return 16
  }
}
