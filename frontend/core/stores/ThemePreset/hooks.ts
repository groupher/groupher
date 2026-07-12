'use client'

import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useThemePreset = createStoreHook(StoreContext, ['hydrate', 'hydratePresetOptions'])

export default useThemePreset
