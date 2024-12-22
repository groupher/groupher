import type { TSubMenu } from '../spec'
import { SUB_MENU_TYPE } from '../constant'

export const getSubMenuWidth = (subType: TSubMenu): string => {
  switch (subType) {
    case SUB_MENU_TYPE.EDIT: {
      return 'w-72'
    }
    case SUB_MENU_TYPE.CATEGORY:
    case SUB_MENU_TYPE.STATE: {
      return 'w-44'
    }
    case SUB_MENU_TYPE.SLUG: {
      return 'w-60'
    }
    case SUB_MENU_TYPE.TAGS: {
      return 'w-48'
    }
    case SUB_MENU_TYPE.MIRROR: {
      return 'w-60'
    }
    default: {
      return 'w-40'
    }
  }
}

export const holder = 1
