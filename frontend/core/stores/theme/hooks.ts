'use client'

import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useTheme = createStoreHook(StoreContext, ['change', 'changeMode'])

export default useTheme
