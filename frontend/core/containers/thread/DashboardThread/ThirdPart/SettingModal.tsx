import Image from 'next/image'
import ArrowLinker from '~/widgets/ArrowLinker'
import Button from '~/widgets/Buttons/Button'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import Input from '~/widgets/Input'
import Modal from '~/widgets/Modal'
import useTrans from '~/hooks/useTrans'
import useSalon, { cn } from '../salon/third_part/setting_modal'

import type { TIntegrateAnalysisTool } from './spec'

type TProps = {
  show: boolean
  service: TIntegrateAnalysisTool | null

  onClose: () => void
}

const SettingModal = ({ show, onClose, service }: TProps) => {
  const s = useSalon()
  const { t } = useTrans()

  if (!service) return null

  return (
    <Modal show={show} width='460px' onClose={() => onClose()} showCloseBtn={false}>
      <div className={s.wrapper}>
        <div className={s.header}>
          <div className={s.iconBox}>
            <Image
              src={`/integrations/${service.key}.png`}
              alt={`${service.title} icon`}
              width={28}
              height={28}
              className={cn(
                s.icon,
                service.key === 'hotjar' && 'w-10 h-auto',
                service.key === 'gtm' && 'w-8 h-auto',
              )}
              priority={false}
              unoptimized
            />
          </div>
          <h1 className={s.title}>{t(service.title)}</h1>
          <span className={s.enable}>{t('dsb.third_part.enable')}</span>
          <ToggleSwitch checked />
        </div>
        <div className={s.content}>
          <p className={s.desc}>{t(service.detail)}</p>
        </div>
        <div className={s.br} />
        <h2 className={s.subTitle}>{t(service.trackLabel)}</h2>
        <p className={cn(s.desc, 'mb-4')}>{t(service.trackDesc)}</p>
        <Input placeholder={t(service.placeholder)} />

        <div className={s.br} />

        <div className={s.footer}>
          <ArrowLinker href={service.homepage} target='_blank' noColor>
            {t('dsb.third_part.learn_more')}
          </ArrowLinker>

          <Button disabled={false} onClick={() => console.log('## TODO')}>
            {t('dsb.third_part.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default SettingModal
