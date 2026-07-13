'use client'

import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useArticle = createStoreHook(StoreContext)

export default useArticle
