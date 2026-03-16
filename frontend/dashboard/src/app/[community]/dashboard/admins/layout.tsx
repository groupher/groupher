'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cnMerge } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import ArrowButton from '~/widgets/Buttons/ArrowButton'

const seg = DSB_ROUTE.ADMINS
const CRUMB_CONFIG = {
  title: 'dsb.crumb.workplace',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [{ title: 'dsb.crumb.admins', seg }],
} satisfies TCrumbConfig

export default function Layout({ children }) {
  const s = useSalon()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)
  const { t } = useTrans()

  return (
    <div className={cnMerge(s.content, 'w-3/5')}>
      <Portal
        title={t('dsb.portal.admins.title')}
        desc={
          <>
            {t('dsb.portal.admins.desc')}
            <div className='inline-block'>
              <ArrowButton>{t('dsb.portal.admins.guide')}</ArrowButton>
            </div>
          </>
        }
        crumbItems={crumbItems}
      />
      {children}
    </div>
  )
}
