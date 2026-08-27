'use client'

import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useDsb = createStoreHook(StoreContext, [
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

export default useDsb
