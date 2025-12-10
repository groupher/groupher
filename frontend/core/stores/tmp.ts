import { proxy } from 'valtio'

import setupArticles from './articles/tmp'
import type { TRootStoreInit } from './spec'

export { default as StoreProvider } from './provider'

const INITIAL_STATE = {
  // theme: THEME.LIGHT,
  articles: {},
}

export const setupRootStore2 = (init: TRootStoreInit = INITIAL_STATE) => {
  return proxy({
    articles: setupArticles(init.articles),
  })
}
