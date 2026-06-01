export enum PREVIEW_PHASE {
  CACHED_LITE = 'cached-lite',
  CACHED_FULL = 'cached-full',
  LIVE = 'live',
}

export const isLitePreviewPhase = (phase: TPreviewPhase): boolean =>
  phase === PREVIEW_PHASE.CACHED_LITE

export type TPreviewPhase = `${PREVIEW_PHASE}`
