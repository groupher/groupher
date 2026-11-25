'use client'

import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useLocale = createStoreHook(StoreContext, ['setLocale', 'setLocaleData', 'setRouteOverride'])

export default useLocale
