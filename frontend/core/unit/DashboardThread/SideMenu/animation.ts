import { MENU_VIEW } from '../constant'
import type { TMenuView } from './events'

export type TMenuDirection = 1 | -1

export const ACTIVE_TRANSITION = { duration: 0.18, ease: 'easeOut' } as const

export const ACTIVE_LAYOUT_ID = {
  DOC_BG: 'dashboard-doc-menu-active-bg',
  DOC_BAR: 'dashboard-doc-menu-active-bar',
  POST_BG: 'dashboard-post-menu-active-bg',
  POST_BAR: 'dashboard-post-menu-active-bar',
  KANBAN_BG: 'dashboard-kanban-menu-active-bg',
  KANBAN_BAR: 'dashboard-kanban-menu-active-bar',
  CHANGELOG_BG: 'dashboard-changelog-menu-active-bg',
  CHANGELOG_BAR: 'dashboard-changelog-menu-active-bar',
  MAIN_BG: 'dashboard-main-menu-active-bg',
  MAIN_BAR: 'dashboard-main-menu-active-bar',
} as const

// Direction is from the incoming menu's perspective: submenus enter from the right,
// Back returns Main from the left, while the outgoing menu exits opposite.
export const getMenuDirection = (view: TMenuView): TMenuDirection =>
  view === MENU_VIEW.DOC ||
  view === MENU_VIEW.POST ||
  view === MENU_VIEW.KANBAN ||
  view === MENU_VIEW.CHANGELOG
    ? 1
    : -1

export const menuVariants = {
  initial: (direction: TMenuDirection) => ({ opacity: 0, x: direction * 16 }),
  animate: { opacity: 1, x: 0 },
  exit: (direction: TMenuDirection) => ({ opacity: 0, x: direction * -16 }),
}
