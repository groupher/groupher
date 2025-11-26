import { AVATAR_LAYOUT } from '~/const/layout'
import useDashboard from '~/hooks/useDashboard'
import type { TAvatarLayout } from '~/spec'

type TRet = {
  avatarLayout: TAvatarLayout
  isSquare: boolean
}

export default (): TRet => {
  const store = useDashboard()

  const { avatarLayout } = store

  return {
    avatarLayout,
    isSquare: avatarLayout === AVATAR_LAYOUT.SQUARE,
  }
}
