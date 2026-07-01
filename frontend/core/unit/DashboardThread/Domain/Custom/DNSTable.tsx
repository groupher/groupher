import useTrans from '~/hooks/useTrans'

import useSalon, { cn } from '../salon/custom/dns_table'
import type { TDnsRecord } from './constant'

type Props = {
  records: TDnsRecord[]
}

export default function DnsRecordsTable({ records }: Props) {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <table className={s.table}>
        <thead className={s.thead}>
          <tr>
            <th className={s.th}>{t('dsb.domain.custom.dns.type')}</th>
            <th className={s.th}>{t('dsb.domain.custom.dns.host_name')}</th>
            <th className={s.th}>{t('dsb.domain.custom.dns.value')}</th>
          </tr>
        </thead>

        <tbody>
          {records.map((record) => (
            <tr key={`${record.type}:${record.host}`} className={s.tr}>
              <td className={s.td}>{record.type}</td>
              <td className={s.td}>{record.host}</td>
              <td className={cn(s.td, 'break-all')}>{record.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
