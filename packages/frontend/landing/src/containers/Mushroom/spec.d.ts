import type { TScrollDirection } from '~/spec'

export type TStore = {
  online: boolean
  isMobile: boolean
  showUserListModal: boolean
  bodyScrollDirection: TScrollDirection

  commit: (patch: Partial<TStore>) => void
}
