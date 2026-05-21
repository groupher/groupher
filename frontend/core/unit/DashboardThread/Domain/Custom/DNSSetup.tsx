import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'

import useSalon, { cn } from '../salon/custom/dns_setup'
import { DNS_RECORDS } from './constant'
import DnsRecordsTable from './DNSTable'

type TProps = {
  onNext: () => void
}

const DNSSetup: FC<TProps> = ({ onNext }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{t('dsb.domain.custom.dns.title')}</div>
      <div className={cn(s.desc)}>{t('dsb.domain.custom.dns.desc')}</div>

      <DnsRecordsTable records={DNS_RECORDS} />

      <div className={s.title}>{t('dsb.domain.custom.dns.faq_time_title')}</div>

      <div className={cn(s.desc, 'mb-5')}>{t('dsb.domain.custom.dns.faq_time_desc')}</div>

      <div className={s.title}>{t('dsb.domain.custom.dns.after_title')}</div>

      <div className={cn(s.desc, 'mb-5')}>{t('dsb.domain.custom.dns.after_desc')}</div>

      <div className={s.title}>{t('dsb.domain.custom.dns.cloudflare_title')}</div>

      <div className={cn(s.desc, 'mb-5')}>{t('dsb.domain.custom.dns.cloudflare_desc')}</div>

      <div className={s.br} />

      <Button disabled={false} onClick={onNext}>
        {t('dsb.domain.custom.dns.verify')}
      </Button>
    </div>
  )
}

export default DNSSetup
