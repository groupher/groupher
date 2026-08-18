import type { TTagsMode } from './spec'

/** Runs the tags mode change operation at the frontend shared boundary. */
export const tagsModeChange = (_tagsMode: TTagsMode): void => {
  // store.mark({ _tagsMode })
}
