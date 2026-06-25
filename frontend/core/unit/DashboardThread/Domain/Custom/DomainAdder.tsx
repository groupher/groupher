import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'

import useSalon from '../salon/custom/domain_adder'

type TProps = {
  onNext: () => void
}

const DomainAdder: FC<TProps> = ({ onNext }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{t('dsb.domain.custom.adder.title')}</div>
      <div className={s.desc}>{t('dsb.domain.custom.adder.desc')}</div>

      <div className={s.inputWrapper}>
        <Input
          value=''
          placeholder={t('dsb.domain.custom.adder.placeholder')}
          disableEnter
          focusOnMount
          width='w-full'
        />
      </div>

      <div className={s.desc}>{t('dsb.domain.custom.adder.tip')}</div>
      <div className={s.br} />

      <Button disabled={false} onClick={onNext}>
        {t('dsb.domain.custom.adder.add')}
      </Button>
    </div>
  )
}

export default DomainAdder
