'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cnMerge } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'

import type { TCrumbConfig } from '~/spec'

const seg = DSB_ROUTE.THREADS
const CRUMB_CONFIG = {
  title: 'dsb.crumb.workplace',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [{ title: 'dsb.crumb.thread_manage', seg }],
} satisfies TCrumbConfig

export default ({ children }) => {
  const s = useSalon()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)
  const { t } = useTrans()

  return (
    <div className={cnMerge(s.content, 'w-2/5')}>
      <Portal
        title={t('dsb.portal.threads.title')}
        desc={t('dsb.portal.threads.desc')}
        crumbItems={crumbItems}
      />

      {children}
    </div>
  )
}
