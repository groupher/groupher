'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'

const seg = DSB_ROUTE.HEADER
export const CRUMB_CONFIG = {
  title: 'dsb.crumb.workplace',
  seg,
  toSeg: DSB_COVERS.INTEGRATIONS,
  children: [{ title: 'dsb.crumb.header', seg }],
}

export default ({ children }) => {
  const s = useSalon()
  const { t } = useTrans()

  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cn(s.content, 'w-10/12 ml-20')}>
      <Portal
        title={t('dsb.portal.header.title')}
        desc={t('dsb.portal.header.desc')}
        withDivider={true}
        crumbItems={crumbItems}
      />

      {children}
    </div>
  )
}
