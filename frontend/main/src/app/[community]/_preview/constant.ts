export enum PREVIEW_PHASE {
  CACHED_LITE = 'cached-lite',
  CACHED_FULL = 'cached-full',
  LIVE = 'live',
}

/** Reports whether lite preview phase at the frontend shared boundary. */
export const isLitePreviewPhase = (phase: TPreviewPhase): boolean =>
  phase === PREVIEW_PHASE.CACHED_LITE

export type TPreviewPhase = `${PREVIEW_PHASE}`
