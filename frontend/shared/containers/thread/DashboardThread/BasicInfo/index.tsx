import { useRouter } from 'next/navigation'

import { DASHBOARD_BASEINFO_ROUTE } from '~/const/route'
import VIEW from '~/const/view'

import useViewingCommunity from '~/hooks/useViewingCommunity'
import Tabs from '~/widgets/Switcher/Tabs'

import { BASEINFO_TABS } from '../constant'

import Portal from '../Portal'

import BaseInfo from './BaseInfo'
import Logos from './Logos'
import SocialInfo from './SocialInfo'
import OtherInfo from './OtherInfo'

import useBaseInfo from '../logic/useBaseInfo'
import useSalon from '../salon/basic_info'

export default () => {
  const s = useSalon()

  const router = useRouter()
  const curCommunity = useViewingCommunity()
  const { baseInfoTab, edit } = useBaseInfo()

  return (
    <div className={s.wrapper}>
      <Portal
        title="社区信息"
        desc="社区基本信息，社交媒体，关于页面主要信息等。"
        withDivider={false}
      />

      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs
            items={BASEINFO_TABS}
            activeKey={baseInfoTab}
            onChange={(tab) => {
              // @ts-ignore
              edit(tab, 'baseInfoTab')
              const targetPath =
                tab === DASHBOARD_BASEINFO_ROUTE.BASIC
                  ? `/${curCommunity.slug}/dashboard/info`
                  : `/${curCommunity.slug}/dashboard/info/${tab}`

              router.push(targetPath)
            }}
            view={VIEW.DESKTOP}
            noAnimation
          />
        </div>
      </div>

      {baseInfoTab === DASHBOARD_BASEINFO_ROUTE.BASIC && <BaseInfo />}
      {baseInfoTab === DASHBOARD_BASEINFO_ROUTE.LOGOS && <Logos />}
      {baseInfoTab === DASHBOARD_BASEINFO_ROUTE.SOCIAL && <SocialInfo />}
      {baseInfoTab === DASHBOARD_BASEINFO_ROUTE.OTHER && <OtherInfo />}
    </div>
  )
}
