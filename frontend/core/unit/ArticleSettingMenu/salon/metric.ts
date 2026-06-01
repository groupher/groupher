import { SUB_MENU } from '../constant'
import type { TSubMenu } from '../spec'

export const getSubMenuWidth = (subType: TSubMenu): string => {
  switch (subType) {
    case SUB_MENU.EDIT: {
      return 'w-72'
    }
    case SUB_MENU.CATEGORY:
    case SUB_MENU.STATUS: {
      return 'w-44'
    }
    case SUB_MENU.SLUG: {
      return 'w-60'
    }
    case SUB_MENU.TAGS: {
      return 'w-48'
    }
    case SUB_MENU.MIRROR: {
      return 'w-60'
    }
    default: {
      return 'w-44'
    }
  }
}
