'use client'

import type { ReactNode } from 'react'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import { I18N_NS } from '~/i18n/namespaces'
import type { TCrumbConfig, TLocale } from '~/spec'
import ExtraLocaleProvider from '~/stores/locale/extra-provider'
import Portal from '~/unit/DashboardThread/Portal'
import useSalon, { cnMerge } from '~/unit/DashboardThread/salon'
import ArrowButton from '~/widgets/Buttons/ArrowButton'

type TProps = {
  children: ReactNode
  extraLocaleData: Record<string, string>
  extraLocale: TLocale
}

const seg = DSB_ROUTE.ADMINS
const CRUMB_CONFIG = {
  title: 'dsb.crumb.workplace',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [{ title: 'dsb.crumb.admins', seg }],
} satisfies TCrumbConfig

function Content({ children }: { children: ReactNode }) {
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
            <span className='inline-block'>
              <ArrowButton>{t('dsb.portal.admins.guide')}</ArrowButton>
            </span>
          </>
        }
        crumbItems={crumbItems}
      />
      {children}
    </div>
  )
}

export default function ClientLayout({ children, extraLocaleData, extraLocale }: TProps) {
  return (
    <ExtraLocaleProvider
      initData={extraLocaleData}
      initLocale={extraLocale}
      namespaces={I18N_NS.PASSPORT}
    >
      <Content>{children}</Content>
    </ExtraLocaleProvider>
  )
}
