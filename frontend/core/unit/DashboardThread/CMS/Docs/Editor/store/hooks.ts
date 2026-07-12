'use client'

import createStoreHook from '~/stores/createStoreHook'

import { StoreContext } from './context'

const useDocsEditor = createStoreHook(StoreContext, [
  'addGroup',
  'attachSideTree',
  'attachSaveDocDraft',
  'reloadDocDraft',
  'reloadSideTree',
  'saveDocDraft',
  'setMode',
  'setPublishRuntime',
  'setDocDraftSession',
])

export default useDocsEditor
