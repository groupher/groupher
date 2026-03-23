import { AVATAR_LAYOUT } from '~/const/layout'
import type { TAvatarLayout } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

type TRet = {
  avatarLayout: TAvatarLayout
  isSquare: boolean
}

export default function useAvatarLayout(): TRet {
  const dsb$ = useDashboard()

  const { avatarLayout } = dsb$

  return {
    avatarLayout,
    isSquare: avatarLayout === AVATAR_LAYOUT.SQUARE,
  }
}
