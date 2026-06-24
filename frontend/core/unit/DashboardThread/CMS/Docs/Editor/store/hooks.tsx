'use client'

import createStoreHook from '~/stores/createStoreHook'

import { StoreContext } from './provider'

export default createStoreHook(StoreContext, [
  'addGroup',
  'attachSideTree',
  'attachSaveDocDraft',
  'reloadDocDraft',
  'reloadSideTree',
  'saveDocDraft',
  'setMode',
  'setDocDraftSession',
])
