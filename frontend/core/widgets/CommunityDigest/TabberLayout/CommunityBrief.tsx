import { ANCHOR } from '~/const/dom'
import { BRAND_LAYOUT } from '~/const/layout'
import { assetSrc } from '~/helper'
import useActiveTag from '~/hooks/useActiveTag'
import useCommunity from '~/hooks/useCommunity'
import useLayout from '~/hooks/useLayout'

import Img from '~/Img'
import MoreSVG from '~/icons/menu/More'

import { callGEditor, callSyncSelector } from '~/signal'
import AccountUnit from '~/widgets/AccountUnit'
import Button from '~/widgets/Buttons/Button'
import PublishButton from '~/widgets/Buttons/PublishButton'
import ImgFallback from '~/widgets/ImgFallback'

import useSalon from '../salon/tabber_layout/community_brief'

export default () => {
  const s = useSalon()
  const activeTag = useActiveTag()

  const { logo, title } = useCommunity()
  const { brandLayout } = useLayout()

  const COVER_IMAGE = '/banner-cover.webp'

  return (
    <div className={s.wrapper} id={ANCHOR.GLOBAL_HEADER_ID}>
      <div className={s.accountWrapper}>
        <AccountUnit />
      </div>
      {COVER_IMAGE ? (
        <Img className={s.cover} src={COVER_IMAGE} noLazy />
      ) : (
        <div className={s.coverHolder} />
      )}
      <div className={s.main}>
        {brandLayout !== BRAND_LAYOUT.TEXT && (
          <div className={s.logoBox}>
            <Img className={s.logo} src={assetSrc(logo)} fallback={<ImgFallback title={title} />} />
          </div>
        )}

        <div className={s.communityInfo}>
          <h2 className={s.title}>{title}</h2>
        </div>

        <div className={s.actions}>
          <PublishButton
            text='参与讨论'
            onMenuSelect={(cat) => {
              callGEditor()
              setTimeout(() => callSyncSelector({ cat, tag: activeTag }), 500)
            }}
            offset={[0, 5]}
          />
          <Button ghost left={1} className='scale-90 mt-0.5'>
            <MoreSVG className={s.more} />
          </Button>
        </div>
      </div>
    </div>
  )
}
