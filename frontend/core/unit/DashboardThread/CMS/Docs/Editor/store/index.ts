import { proxy } from 'valtio'

import type { TInit, TStore } from './spec'

export default function DocsEditorStore(init: TInit): TStore {
  // Docs editor actions are split across the tree, article, snackbar, and future drawers.
  // Keep cross-region session commands here so toolbar actions do not reach into SideTree props.
  let sideTree = init.sideTree

  const initialStore: TStore = {
    addGroup: (): void => {
      sideTree.addGroup()
    },

    attachSideTree: (nextSideTree): void => {
      sideTree = nextSideTree
    },
  }

  const store = proxy(initialStore)
  return store
}
