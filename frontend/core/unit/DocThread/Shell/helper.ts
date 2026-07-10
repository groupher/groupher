import { DOC_PUBLIC_TREE_WIDTH } from '../Tree/constant'

export const clampDocPublicTreeWidth = (width: number): number => {
  return Math.min(DOC_PUBLIC_TREE_WIDTH.max, Math.max(DOC_PUBLIC_TREE_WIDTH.min, width))
}
