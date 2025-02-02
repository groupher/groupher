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

export const getMarginRight = (size: string, mobileView: boolean): string => {
  if (mobileView) return '5px'

  switch (size) {
    case SIZE.SMALL: {
      return '0'
    }

    default:
      return '18px'
  }
}

export const getPadding = (
  size: string,
  mobileView: boolean,
  wrapMode: boolean,
  modelineView: boolean,
): string => {
  if (modelineView) {
    return '6px 10px'
  }

  if (mobileView) {
    if (wrapMode) {
      return '5px'
    }
    return '10px'
  }

  switch (size) {
    case SIZE.SMALL: {
      return '5px 14px'
    }

    default:
      return '12px 10px'
  }
}

export const getMarginBottom = (wrapMode: boolean): string => {
  if (wrapMode) return '4px'

  return '0'
}
