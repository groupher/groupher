import Image from 'next/image'
import type { FC } from 'react'
import { useState } from 'react'
import useTrans from '~/hooks/useTrans'
import useSalon, { cn } from '../salon/third_part'
import { INTEGRATE_ANALYSIS_TOOLS } from './constant'
import SettingModal from './SettingModal'

import type { TIntegrateAnalysisTool } from './spec'

const ThirdPart: FC = () => {
  const [showSettingModal, setShowSettingModal] = useState(false)
  const [selectedService, setSelectedService] = useState<TIntegrateAnalysisTool | null>(null)

  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SettingModal
        show={showSettingModal}
        service={selectedService}
        onClose={() => setShowSettingModal(false)}
      />

      <div className={s.inner}>
        {INTEGRATE_ANALYSIS_TOOLS.map((item) => (
          <button
            key={item.key}
            className={s.block}
            onClick={() => {
              setSelectedService(item)
              setShowSettingModal(true)
            }}
          >
            <div className={s.iconBox}>
              <Image
                src={`/integrations/${item.key}.png`}
                alt={`${t(item.title)} icon`}
                width={28}
                height={28}
                className={cn(
                  s.icon,
                  item.key === 'hotjar' && 'w-14 h-auto',
                  item.key === 'gtm' && 'w-12 h-auto',
                )}
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
