import { useRouter } from 'next/navigation'

import { DSB_BASEINFO_ROUTE } from '~/const/route'
import VIEW from '~/const/view'

import useCommunity from '~/hooks/useCommunity'
import Tabs from '~/widgets/Switcher/Tabs'

import { BASEINFO_TABS } from '../constant'
import useBaseInfo from '../logic/useBaseInfo'
import Portal from '../Portal'
import useSalon from '../salon/basic_info'
import BaseInfo from './BaseInfo'
import Logos from './Logos'
import OtherInfo from './OtherInfo'
import SocialInfo from './SocialInfo'

export default () => {
  const s = useSalon()

  const router = useRouter()
  const { slug } = useCommunity()
  const { baseInfoTab, edit } = useBaseInfo()

  return (
    <div className={s.wrapper}>
      <Portal
        title='社区信息'
        desc='社区基本信息，社交媒体，关于页面主要信息等。'
        withDivider={false}
      />

      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs
            items={BASEINFO_TABS}
            activeKey={baseInfoTab}
            onChange={(tab) => {
              // TODO: use Route.push to change the url, then the url will be sync to store by hook
              // @ts-expect-error
              edit(tab, 'baseInfoTab')
              const targetPath =
                tab === DSB_BASEINFO_ROUTE.BASIC
                  ? `/${slug}/dashboard/info`
                  : `/${slug}/dashboard/info/${tab}`

              router.push(targetPath)
            }}
            view={VIEW.DESKTOP}
            noAnimation
          />
        </div>
      </div>

      {baseInfoTab === DSB_BASEINFO_ROUTE.BASIC && <BaseInfo />}
      {baseInfoTab === DSB_BASEINFO_ROUTE.LOGOS && <Logos />}
      {baseInfoTab === DSB_BASEINFO_ROUTE.SOCIAL && <SocialInfo />}
      {baseInfoTab === DSB_BASEINFO_ROUTE.OTHER && <OtherInfo />}
    </div>
  )
}
