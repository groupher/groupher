import { SITE_SHARE_TYPE } from '../constant'

//
export const getInfoPanelHeight = (type: string): string => {
  switch (type) {
    case SITE_SHARE_TYPE.WECHAT: {
      return 'h-40'
    }

    case SITE_SHARE_TYPE.EMBED: {
      return 'h-40'
    }

    default: {
      return 'h-32'
    }
  }
}
