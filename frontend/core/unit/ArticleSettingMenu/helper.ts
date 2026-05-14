import { COLOR } from '~/const/colors'
import { ARTICLE_STATUS } from '~/const/gtd'
import type { TArticleStatus, TColorName } from '~/spec'

export const getGTDColor = (status: TArticleStatus, bgColors: TColorName[]): TColorName => {
  switch (status) {
    case ARTICLE_STATUS.BACKLOG: {
      return bgColors[0]
    }

    case ARTICLE_STATUS.TODO: {
      return bgColors[0]
    }
    case ARTICLE_STATUS.WIP: {
      return bgColors[1]
    }

    case ARTICLE_STATUS.DONE: {
      return bgColors[2]
    }

    default:
      return COLOR.RED
  }
}
