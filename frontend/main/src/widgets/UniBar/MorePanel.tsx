import Link from 'next/link'

import useTrans from '~/hooks/useTrans'
import useViewingCommunity from '~/hooks/useViewingCommunity'

import { DASHBOARD_ROUTE } from '~/const/route'

import ReportSVG from '~/icons/Report'
import SettingSVG from '~/icons/Setting'
import LinkSVG from '~/icons/ArrowUpRight'

import HomeLogo from '~/widgets/HomeLogo'

import MenuBar from './MenuBar'
import useSalon from './salon/more_panel'

export default () => {
  const s = useSalon()
  const { slug } = useViewingCommunity()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <Link href={`/${slug}/${DASHBOARD_ROUTE.OVERVIEW}`} className={s.linkable}>
        <MenuBar>
          <div className={s.iconBox}>
            <SettingSVG className={s.dashboardIcon} />
          </div>
          {t('dashboard')}
          <div className="grow" />
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
