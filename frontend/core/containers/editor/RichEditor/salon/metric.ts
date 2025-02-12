export const getWidth = (type) => {
  switch (type) {
    case 'comment': {
      return '620px'
    }
    default: {
      return '680px'
    }
  }
}

export const getMinHeight = (type) => {
  switch (type) {
    case 'comment': {
      return '180px'
    }
    default: {
      return '360px'
    }
  }
}
