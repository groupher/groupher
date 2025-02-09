import type { TColorName, TArticleState } from '~/spec'
import { COLOR_NAME } from '~/const/colors'
import { ARTICLE_STATE } from '~/const/gtd'

export const getGTDColor = (state: TArticleState, bgColors: TColorName[]): TColorName => {
  switch (state) {
    case ARTICLE_STATE.TODO: {
      return bgColors[0]
    }
    case ARTICLE_STATE.WIP: {
      return bgColors[1]
    }

    case ARTICLE_STATE.DONE: {
      return bgColors[2]
    }

    default:
      return COLOR_NAME.RED
  }
}

export const holder = 1
