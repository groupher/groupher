import { DOC_PUBLIC_TREE_WIDTH } from '../Tree/constant'

/** Runs the clamp doc public tree width operation at the frontend shared boundary. */
export const clampDocPublicTreeWidth = (width: number): number => {
  return Math.min(DOC_PUBLIC_TREE_WIDTH.max, Math.max(DOC_PUBLIC_TREE_WIDTH.min, width))
}
