'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cnMerge } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'

const seg = DSB_ROUTE.TAGS
const CRUMB_CONFIG = {
  title: 'dsb.crumb.cms',
  seg,
  toSeg: DSB_COVERS.CMS,
  children: [{ title: 'dsb.crumb.tags', seg }],
} satisfies TCrumbConfig

export default function Layout({ children }) {
  const s = useSalon()
  const { t } = useTrans()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cnMerge(s.content, 'w-1/2')}>
      <Portal
        title={t('dsb.portal.tags.title')}
        desc={t('dsb.portal.tags.desc')}
        crumbItems={crumbItems}
      />

      {children}
    </div>
  )
}
