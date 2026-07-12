'use client'

import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useComments = createStoreHook(StoreContext, ['commit', 'reset'])

export default useComments
