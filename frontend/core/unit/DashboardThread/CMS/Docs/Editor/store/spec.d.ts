import type { TSideTreeController } from '../SideTree/useSideTree'

export type TInit = {
  sideTree: TSideTreeController
}

export type TStore = {
  addGroup: () => void
  attachSideTree: (sideTree: TSideTreeController) => void
}
