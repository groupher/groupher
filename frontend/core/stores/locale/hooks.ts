'use client'

import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useLocale = createStoreHook(StoreContext, ['setLocale', 'setLocaleData'])

export default useLocale
