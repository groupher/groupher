'use client'

import createStoreHook from '../createStoreHook'
import { StoreContext } from './provider'

export default createStoreHook(StoreContext, [
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
