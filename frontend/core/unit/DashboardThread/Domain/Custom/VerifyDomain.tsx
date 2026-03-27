import type { FC } from 'react'
import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'
import useSalon, { cn } from '../../salon/domain/custom/verify_domain'
import { VERIFYING_DOMAIN_ROWS } from './constant'
import VerifyingTable from './VerifyingTable'

const VerifyDomain: FC = () => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{t('dsb.domain.verify.title')}</div>

      <div className={cn(s.desc, 'mb-5')}>{t('dsb.domain.verify.desc')}</div>

      <div className={s.title}>{t('dsb.domain.verify.records_title')}</div>
      <div className={cn(s.desc, 'mb-3')}>{t('dsb.domain.verify.records_desc')}</div>

      <VerifyingTable rows={VERIFYING_DOMAIN_ROWS} />

      <div className={cn(s.desc, 'mb-4')}>{t('dsb.domain.verify.waiting')}</div>

      <div className={s.br} />

      <div className={s.footer}>
        <Button disabled onClick={() => {}}>
          {t('dsb.domain.verify.verifying')}
        </Button>

        <Button red onClick={() => {}}>
          {t('dsb.domain.verify.remove')}
        </Button>
      </div>
    </div>
  )
}

export default VerifyDomain
