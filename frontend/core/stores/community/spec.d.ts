import type { TCommunity } from '~/spec'

export type TInit = TCommunity

export type TStore = TInit & {
  communityDigestInView: boolean
  commit: (patch: Partial<TStore>) => void
}
