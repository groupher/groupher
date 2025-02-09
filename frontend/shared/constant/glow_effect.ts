import { keys } from 'ramda'

export const GLOW_OPACITY = {
  NORMAL: '100',
  WEEK: '65',
}

export const GLOW_EFFECT_NAME = {
  ORANGE_PURPLE: 'ORANGE_PURPLE',
  GREY_BROWN: 'GREY_BROWN',
  YELLOW_RED: 'YELLOW_RED',
  GREY_GREEN: 'GREY_GREEN',
  PURPLE_BLUE: 'PURPLE_BLUE',
}

export const GLOW_EFFECTS_DAY = {
  ORANGE_PURPLE: {
    LEFT: {
      COLOR: '#f39e8d26',
      X: '25%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#ffeba824',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#4e4bd212',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#961fb314',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  GREY_BROWN: {
    LEFT: {
      COLOR: '#e7dcd08a',
      X: '20%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#d4003f03',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },

    MAIN: {
      COLOR: '#ff980012',
      X: '72%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#f6c49f1c',
      X: '80%',
      Y: '18%',
      RADIUS: '30%',
    },
  },
  YELLOW_RED: {
    LEFT: {
      COLOR: '#ffc43b2b',
      X: '20%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#d4003f03',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },

    MAIN: {
      COLOR: '#f4433621',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#ff98000a',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  GREY_GREEN: {
    LEFT: {
      COLOR: '#f3f0dfe3',
      X: '30%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#e9ede000',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#e9ede0a6',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#fefdf629',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  PURPLE_BLUE: {
    LEFT: {
      COLOR: '#e2eaf58f',
      X: '28%',
      Y: '-8%',
      RADIUS: '26%',
    },
    RIGHT1: {
      COLOR: '#91dfe900',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#d5e9fb59',
      X: '70%',
      Y: '4%',
      RADIUS: '35%',
    },
    RIGHT2: {
      COLOR: '#d5e9fb70',
      X: '85%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
}

export const GLOW_EFFECTS_NIGHT = {
  ORANGE_PURPLE: {
    LEFT: {
      COLOR: '#f39e8d26',
      X: '25%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#ffeba824',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#4e4bd212',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#961fb314',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  GREY_BROWN: {
    LEFT: {
      COLOR: '#5f564c8a',
      X: '20%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#d4003f03',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },

    MAIN: {
      COLOR: '#ff980012',
      X: '72%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#f6c49f1c',
      X: '80%',
      Y: '18%',
      RADIUS: '30%',
    },
  },
  YELLOW_RED: {
    LEFT: {
      COLOR: '#ffc43b2b',
      X: '20%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#d4003f03',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },

    MAIN: {
      COLOR: '#f4433621',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#ff98000a',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  GREY_GREEN: {
    LEFT: {
      COLOR: '#444b428a',
      X: '30%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#30381fa6',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#2e3323a6',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#363c2978',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  PURPLE_BLUE: {
    LEFT: {
      COLOR: '#323d498f',
      X: '28%',
      Y: '-8%',
      RADIUS: '26%',
    },
    RIGHT1: {
      COLOR: '#2b36489e',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#12283c59',
      X: '70%',
      Y: '4%',
      RADIUS: '35%',
    },
    RIGHT2: {
      COLOR: '#0e2b4670',
      X: '85%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
}

export const GLOW_EFFECTS_KEYS = keys(GLOW_EFFECTS_DAY)
