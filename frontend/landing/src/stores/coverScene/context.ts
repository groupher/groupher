import { createContext, use } from 'react'

import type { TCoverScene } from '../../const/coverScenes'

export type TCoverSceneContext = {
  scene: TCoverScene
  selectScene: (id: string) => void
}

export const CoverSceneContext = createContext<TCoverSceneContext | null>(null)

export const useCoverScene = (): TCoverSceneContext => {
  const context = use(CoverSceneContext)
  if (!context) throw new Error('useCoverScene must be used within CoverSceneShell')
  return context
}
