import type { TAccount, TCommunity, TUser } from '~/spec'

export type TStore = {
  user: TUser | null
  isLogin: boolean
  isModerator: boolean
  userSubscribedCommunities: TCommunity[] | null

  // views
  accountInfo: TAccount
  // actions
  setSession: (user: TUser, token: string) => void
}
