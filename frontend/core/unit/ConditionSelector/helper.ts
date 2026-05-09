import { find } from 'ramda'

import { POST_CAT_MENU_ITEMS, POST_ORDER_MENU_ITEMS, POST_STATUS_MENU_ITEMS } from '~/const/menu'
import { CONDITION_MODE } from '~/const/mode'
import type { TConditionMode, TTransKey } from '~/spec'

import type { TActiveCondition, TMenuItem } from './spec'

export const getMenuItems = (mode: TConditionMode): TMenuItem[] => {
  switch (mode) {
    case CONDITION_MODE.STATUS: {
      return POST_STATUS_MENU_ITEMS
    }

    case CONDITION_MODE.CAT: {
      return POST_CAT_MENU_ITEMS
    }

    case CONDITION_MODE.ORDER: {
      return POST_ORDER_MENU_ITEMS
    }

    default: {
      return []
    }
  }
}

export const getActiveMenuItem = (items: TMenuItem[], active: TActiveCondition): TMenuItem => {
  return find((item) => item.key === active, items)
}

export const getTitle = (mode: TConditionMode): TTransKey => {
  switch (mode) {
    case CONDITION_MODE.STATUS: {
      return 'article.status'
    }

    case CONDITION_MODE.CAT: {
      return 'article.cat'
    }

    case CONDITION_MODE.ORDER: {
      return 'article.sort'
    }

    default: {
      return '??'
    }
  }
}
