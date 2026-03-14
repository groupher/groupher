import { AVATAR_LAYOUT } from '~/const/layout'
import useDashboard from '~/hooks/useDashboard'
import type { TAvatarLayout } from '~/spec'

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
