'use client'

import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useArticleList = createStoreHook(StoreContext, ['commit', 'updateActiveFilter'])

export default useArticleList
