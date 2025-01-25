import { find } from 'ramda'

import type { TConditionMode, TTransKey } from '~/spec'
import { CONDITION_MODE } from '~/const/mode'
import { POST_STATE_MENU_ITEMS, POST_CAT_MENU_ITEMS, POST_ORDER_MENU_ITEMS } from '~/const/menu'

import type { TMenuItem, TActiveCondition } from './spec'

export const getMenuItems = (mode: TConditionMode): TMenuItem[] => {
  switch (mode) {
    case CONDITION_MODE.STATE: {
      return POST_STATE_MENU_ITEMS
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
    case CONDITION_MODE.STATE: {
      return 'article.state'
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
