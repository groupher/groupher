'use client'

import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useDashboard = createStoreHook(StoreContext, [
  'commit',
  'editField',
  'editFields',
  'markFieldsToOriginal',
  'acceptFields',
  'replaceOriginal',
  'rollbackFields',
  'isTouched',
  'anyTouched',
])

export default useDashboard
