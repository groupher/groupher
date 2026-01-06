import type { TAccount, TCommunity, TUser } from '~/spec'

export type TStore = {
  user: TUser | null
  loading: boolean
  isLogin: boolean
  isModerator: boolean
  userSubscribedCommunities: TCommunity[] | null

  // views
  accountInfo: TAccount
  // actions
  commit: (patch: Partial<TStore>) => void
}
