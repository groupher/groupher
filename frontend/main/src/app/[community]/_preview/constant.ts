export const PREVIEW_PHASE = {
  CACHED_LITE: 'cached-lite',
  CACHED_FULL: 'cached-full',
  LIVE: 'live',
} as const

export const isLitePreviewPhase = (phase: TPreviewPhase): boolean =>
  phase === PREVIEW_PHASE.CACHED_LITE

export type TPreviewPhase = (typeof PREVIEW_PHASE)[keyof typeof PREVIEW_PHASE]
