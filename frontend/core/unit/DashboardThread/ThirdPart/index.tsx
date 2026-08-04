import Image from 'next/image'
import type { FC } from 'react'
import { useState } from 'react'

import useQuery from '~/hooks/useQuery'
import useTrans from '~/hooks/useTrans'
import S from '~/unit/DashboardThread/schema'

import { getIntegrationIconSrc } from './constant'
import useSalon, { cn } from './salon'
import SettingModal from './SettingModal'
import type { TIntegrateAnalysisTool } from './spec'

const ThirdPart: FC = () => {
  const [showSettingModal, setShowSettingModal] = useState(false)
  const [selectedService, setSelectedService] = useState<TIntegrateAnalysisTool | null>(null)

  const s = useSalon()
  const { t } = useTrans()
  const { data } = useQuery<{ thirdPartyAnalyticsProviders: TIntegrateAnalysisTool[] }>(
    S.thirdPartyAnalyticsProviders,
    {},
  )
  const providers = data?.thirdPartyAnalyticsProviders ?? []

  return (
    <div className={s.wrapper}>
      <SettingModal
        show={showSettingModal}
        service={selectedService}
        onClose={() => setShowSettingModal(false)}
      />

      <div className={s.inner}>
        {providers.map((item) => (
          <button
            type='button'
            key={item.provider}
            className={s.block}
            onClick={() => {
              setSelectedService(item)
              setShowSettingModal(true)
            }}
          >
            <div className={s.iconBox}>
              <Image
                src={getIntegrationIconSrc(item.provider)}
                alt={`${t(item.title)} icon`}
                width={28}
                height={28}
                className={cn(s.icon, item.provider === 'gtm' && 'w-12 h-auto')}
                priority={false}
                unoptimized
              />
            </div>

            <div className={s.title}>{t(item.title)}</div>
            <div className={s.desc}>{t(item.desc)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ThirdPart
