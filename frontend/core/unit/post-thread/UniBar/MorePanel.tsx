import Link from 'next/link'
import { DSB_ROUTE } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import LinkSVG from '~/icons/ArrowUpRight'
import ReportSVG from '~/icons/Report'
import SettingSVG from '~/icons/Setting'
import useCommunity from '~/stores/community/hooks'

import HomeLogo from '~/widgets/HomeLogo'

import MenuBar from './MenuBar'
import useSalon from './salon/more_panel'

export default function MorePanel() {
  const s = useSalon()
  const { slug } = useCommunity()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <Link href={`/${slug}/${DSB_ROUTE.OVERVIEW}`} className={s.linkable}>
        <MenuBar>
          <div className={s.iconBox}>
            <SettingSVG className={s.dashboardIcon} />
          </div>
          {t('dashboard')}
          <div className='grow' />
          <LinkSVG className={s.linkIcon} />
        </MenuBar>
      </Link>

      <div className={s.divider} />
      <MenuBar>
        <div className={s.iconBox}>
          <ReportSVG className={s.icon} />
        </div>
        {t('report')}
      </MenuBar>
      <MenuBar>
        <div className={s.iconBox}>
          <HomeLogo size={4} />
        </div>
        {t('groupher.feedback')}
      </MenuBar>
    </div>
  )
}
