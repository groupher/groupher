import { FAQ_EDITOR_COPY, FAQ_GROUP_MENU_ACTION, FAQ_ITEM_MENU_ACTION } from '../constant'
import type { TFaqGroupMenuAction, TFaqItemMenuAction } from '../spec'

export type TMenuItem<TAction extends string> = {
  action: TAction
  icon: 'add' | 'rename' | 'duplicate' | 'delete'
  title: string
}

export const GROUP_MENU_ITEMS: readonly TMenuItem<TFaqGroupMenuAction>[] = [
  {
    action: FAQ_GROUP_MENU_ACTION.ADD,
    icon: FAQ_GROUP_MENU_ACTION.ADD,
    title: FAQ_EDITOR_COPY.ADD_ITEM,
  },
  {
    action: FAQ_GROUP_MENU_ACTION.RENAME,
    icon: FAQ_GROUP_MENU_ACTION.RENAME,
    title: FAQ_EDITOR_COPY.RENAME,
  },
  {
    action: FAQ_GROUP_MENU_ACTION.DELETE,
    icon: FAQ_GROUP_MENU_ACTION.DELETE,
    title: FAQ_EDITOR_COPY.DELETE,
  },
]

export const ITEM_MENU_ITEMS: readonly TMenuItem<TFaqItemMenuAction>[] = [
  {
    action: FAQ_ITEM_MENU_ACTION.RENAME,
    icon: FAQ_ITEM_MENU_ACTION.RENAME,
    title: FAQ_EDITOR_COPY.RENAME,
  },
  {
    action: FAQ_ITEM_MENU_ACTION.DUPLICATE,
    icon: FAQ_ITEM_MENU_ACTION.DUPLICATE,
    title: FAQ_EDITOR_COPY.DUPLICATE,
  },
  {
    action: FAQ_ITEM_MENU_ACTION.DELETE,
    icon: FAQ_ITEM_MENU_ACTION.DELETE,
    title: FAQ_EDITOR_COPY.DELETE,
  },
]
