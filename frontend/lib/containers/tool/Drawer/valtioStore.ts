import { mergeDeepRight } from 'ramda'
import { proxy } from 'valtio'

import { DASHBOARD_DESC_LAYOUT } from '~/const/layout'

import METRIC from '~/const/metric'
import TYPE from '~/const/type'

import type { TSwipeOption } from './spec'

import type { TStore } from './spec'

const defaultOptions: TSwipeOption = { direction: 'bottom', position: 'M' }

const store = proxy<TStore>({
  visible: false,
  metric: METRIC.COMMUNITY,

  previousURL: null,
  // auchor href in case user navi articles in drawers
  previousHomeURL: null,
  // only works for mobile view
  options: defaultOptions,
  swipeDownAviliable: true,
  swipeUpAviliable: false,
  canBeClose: false,
  headerText: '',
  showHeaderText: false,
  disableContentDrag: false,
  // end of only works for mobile view

  windowWidth: 1520,
  type: null,
  attUser: null,
  userListerType: '',

  // shortcut for modelineMenuType
  mmType: TYPE.MM_TYPE.MORE,
  dashboardDescLayout: DASHBOARD_DESC_LAYOUT.POST_LIST,

  //
  commit: (patch: Partial<TStore>): void => {
    Object.assign(store, mergeDeepRight(store, patch))
  },
})

export default store
