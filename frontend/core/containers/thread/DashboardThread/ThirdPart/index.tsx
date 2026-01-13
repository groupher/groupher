import Image from 'next/image'
import type { FC } from 'react'
import { useState } from 'react'
import useSalon, { cn } from '../salon/third_part'
import { INTEGRATE_ANALYSIS_TOOLS } from './constant'
import SettingModal from './SettingModal'

import type { TIntegrateAnalysisTool } from './spec'

const ThirdPart: FC = () => {
  const [showSettingModal, setShowSettingModal] = useState(false)
  const [selectedService, setSelectedService] = useState<TIntegrateAnalysisTool | null>(null)

  const s = useSalon()

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
                alt={`${item.title} icon`}
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

            <div className={s.title}>{item.title}</div>
            <div className={s.desc}>{item.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ThirdPart
