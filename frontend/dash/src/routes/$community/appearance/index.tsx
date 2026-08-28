import { createFileRoute } from '@tanstack/react-router'

import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import AvatarLayout from '~/unit/DsbThread/Appearance/AvatarLayout'
import BrandLayout from '~/unit/DsbThread/Appearance/BrandLayout'
import CommunityLayout from '~/unit/DsbThread/Appearance/CommunityLayout'
import FloatBackground from '~/unit/DsbThread/Appearance/FloatBackground'
import InlineTagLayout from '~/unit/DsbThread/Appearance/InlineTagLayout'
import NavActiveLayout from '~/unit/DsbThread/Appearance/NavActiveLayout'
import TagLayout from '~/unit/DsbThread/Appearance/TagLayout'
import TopbarLayout from '~/unit/DsbThread/Appearance/TopbarLayout'
import useSalon from '~/unit/DsbThread/useDsbSalon'

export const Route = createFileRoute('/$community/appearance/')({
  component: AppearancePage,
})

function AppearancePage() {
  const s = useSalon()
  const { communityLayout } = useLayout()
  const showNavActiveLayout =
    communityLayout === COMMUNITY_LAYOUT.CLASSIC || communityLayout === COMMUNITY_LAYOUT.SIDEBAR

  return (
    <>
      <CommunityLayout />
      <div className={s.divider} />
      <BrandLayout />
      <div className={s.divider} />
      {showNavActiveLayout && (
        <>
          <NavActiveLayout />
          <div className={s.divider} />
        </>
      )}
      <AvatarLayout />
      <div className={s.divider} />
      <TagLayout />
      <div className={s.divider} />
      <InlineTagLayout />
      <div className={s.divider} />
      <FloatBackground />
      <div className={s.divider} />
      <TopbarLayout />
    </>
  )
}
